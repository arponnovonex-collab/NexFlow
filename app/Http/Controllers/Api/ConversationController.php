<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiSuggestion;
use App\Models\Conversation;
use App\Models\ConversationNote;
use App\Models\ConversationTag;
use App\Models\CustomerChannelIdentity;
use App\Models\Lead;
use App\Models\LeadStatusHistory;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\WebhookEvent;
use App\Services\OpenAIService;
use App\Services\ProductKnowledgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ConversationController extends Controller
{
    public function __construct(
        protected ProductKnowledgeService $knowledgeService,
        protected OpenAIService $aiService
    ) {}

    /**
     * List all conversations with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Conversation::with([
            'customer:id,name,email,phone,avatar_url',
            'socialAccount:id,platform,name,username',
            'assignedUser:id,name,role',
            'latestMessage',
            'lead:id,conversation_id,status,suggested_status,confidence',
            'tags',
        ]);

        // Platform filter
        if ($request->filled('platform')) {
            $query->where('platform', $request->platform);
        }

        // Account filter
        if ($request->filled('social_account_id')) {
            $query->where('social_account_id', $request->social_account_id);
        }

        // Status filter (pending, active, resolved)
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Lead Status filter
        if ($request->filled('lead_status')) {
            $query->whereHas('lead', function ($q) use ($request) {
                $q->where('status', $request->lead_status);
            });
        }

        // Assignment filters
        if ($request->filter === 'assigned_to_me') {
            $query->where('assigned_to_user_id', $user->id);
        } elseif ($request->filter === 'unassigned') {
            $query->whereNull('assigned_to_user_id');
        } elseif ($request->filter === 'human_takeover') {
            $query->where('is_human_takeover', true);
        } elseif ($request->filter === 'unread') {
            $query->where('unread_count', '>', 0);
        }

        // Search customer name, phone, channel profile name, or message text
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->whereHas('customer', function ($cq) use ($search) {
                    $cq->where('name', 'like', "%{$search}%")
                       ->orWhere('phone', 'like', "%{$search}%")
                       ->orWhere('email', 'like', "%{$search}%")
                       ->orWhereHas('channelIdentities', function ($ciq) use ($search) {
                           $ciq->where('profile_name', 'like', "%{$search}%")
                               ->orWhere('platform_customer_id', 'like', "%{$search}%");
                       });
                })->orWhereHas('messages', function ($mq) use ($search) {
                    $mq->where('text', 'like', "%{$search}%");
                });
            });
        }

        $conversations = $query->orderByDesc('last_message_at')->paginate($request->integer('per_page', 25));

        return response()->json([
            'status' => 'success',
            'data' => $conversations,
        ]);
    }

    /**
     * Show single conversation details and messages.
     */
    public function show(Conversation $conversation): JsonResponse
    {
        // Auto-sync any recent messages from Facebook/Instagram
        try {
            $this->syncRemoteMessages($conversation);
        } catch (\Throwable $e) {
            Log::warning('Active Sync on Conversation show failed: ' . $e->getMessage());
        }

        $conversation->load([
            'customer.channelIdentities',
            'socialAccount',
            'assignedUser:id,name,role',
            'lead.relatedProduct',
            'tags',
            'notes.user:id,name',
            'messages' => function ($q) {
                $q->orderBy('created_at', 'asc')->with([
                    'senderUser:id,name',
                    'attachments',
                    'replyTo:id,text,sender_type,sender_user_id,message_type,created_at,metadata',
                    'replyTo.senderUser:id,name',
                ]);
            },
        ]);

        // Auto-enrich customer profile if still generic name or lacks real profile picture
        if (($conversation->platform === 'facebook_page' || $conversation->platform === 'instagram_business') && $conversation->customer) {
            $cust = $conversation->customer;
            $needsName = str_starts_with($cust->name, 'Facebook Customer') || empty($cust->name);
            $needsAvatar = empty($cust->avatar_url) || str_contains($cust->avatar_url, 'unsplash.com');

            if ($needsName || $needsAvatar) {
                $psid = preg_replace('/^t_(?:ig_|wa_)?/', '', $conversation->channel_conversation_id);
                \App\Services\FacebookProfileService::resolveCustomerName($conversation->socialAccount, $psid, $cust);
                $conversation->load('customer');
            }
        }

        // Auto-backfill attachments for any photo messages that lack attachments
        foreach ($conversation->messages as $msg) {
            if ($msg->attachments->isEmpty() && ($msg->text === '📷 [Photo]' || $msg->message_type === 'attachment' || $msg->message_type === 'image')) {
                if ($msg->platform_message_id) {
                    $event = WebhookEvent::where('payload', 'like', '%' . $msg->platform_message_id . '%')->first();
                    if ($event && ! empty($event->payload['entry'])) {
                        foreach ($event->payload['entry'] as $entry) {
                            foreach ($entry['messaging'] ?? [] as $m) {
                                if (($m['message']['mid'] ?? '') === $msg->platform_message_id && ! empty($m['message']['attachments'])) {
                                    foreach ($m['message']['attachments'] as $att) {
                                        $url = $att['payload']['url'] ?? null;
                                        if ($url) {
                                            $createdAtt = MessageAttachment::create([
                                                'message_id' => $msg->id,
                                                'file_url' => $url,
                                                'file_type' => $att['type'] ?? 'image',
                                                'file_name' => ($att['type'] ?? 'image') . '_' . substr(md5($url), 0, 8),
                                            ]);
                                            $msg->attachments->push($createdAtt);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Hide sensitive token before returning
        $conversation->socialAccount?->makeHidden(['access_token', 'refresh_token']);

        // Reset unread count and mark customer messages as read when opened
        $conversation->update(['unread_count' => 0]);
        $conversation->messages()
            ->where('sender_type', 'customer')
            ->where('delivery_status', '!=', 'read')
            ->update(['delivery_status' => 'read']);

        return response()->json([
            'status' => 'success',
            'data' => $conversation,
        ]);
    }

    /**
     * Get only latest messages since last known ID (for real-time polling).
     */
    public function latestMessages(Request $request, Conversation $conversation): JsonResponse
    {
        // Quick active sync check for outbound Page replies or standby webhooks
        try {
            $this->syncRemoteMessages($conversation);
        } catch (\Throwable $e) {}

        $afterId = $request->query('after_id');
        $query = $conversation->messages()
            ->with([
                'senderUser:id,name',
                'attachments',
                'replyTo:id,text,sender_type,sender_user_id,message_type,created_at,metadata',
                'replyTo.senderUser:id,name',
            ])
            ->orderBy('created_at', 'asc');

        if ($afterId) {
            $query->where('id', '>', (int) $afterId);
        }

        $newMessages = $query->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'messages' => $newMessages,
                'is_human_takeover' => (bool) $conversation->is_human_takeover,
                'status' => $conversation->status,
                'ai_mode' => $conversation->ai_mode,
                'last_message_at' => $conversation->last_message_at,
            ],
        ]);
    }

    /**
     * Send a message from moderator (supports photo, video, audio/voice, and documents).
     */
    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'text' => 'nullable|string',
            'is_internal_note' => 'nullable',
            'file' => 'nullable|file|max:25600', // 25MB max (Meta's limit)
            'image' => 'nullable|file|max:25600',
            'audio' => 'nullable|file|max:25600',
            'media_id' => 'nullable|integer|exists:media_files,id',
            'reply_to_message_id' => 'nullable|integer|exists:messages,id',
        ]);

        $user = $request->user();
        $isNote = filter_var($request->input('is_internal_note'), FILTER_VALIDATE_BOOLEAN);
        $text = $request->input('text');
        $uploadedFile = $request->file('file') ?? $request->file('image') ?? $request->file('audio');
        $mediaId = $request->input('media_id');
        $replyToId = $request->input('reply_to_message_id');
        $replyToMessage = $replyToId ? Message::with('senderUser:id,name')->find($replyToId) : null;

        if (empty(trim((string) $text)) && ! $uploadedFile && ! $mediaId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Please enter a message or attach a file/photo/voice note to send.',
            ], 422);
        }

        $attachmentData = null;
        if ($uploadedFile) {
            $mime = $uploadedFile->getMimeType() ?: 'application/octet-stream';
            $clientExt = strtolower($uploadedFile->getClientOriginalExtension() ?: '');
            $originalName = $uploadedFile->getClientOriginalName() ?: 'attachment';
            $requestedFileType = $request->input('file_type');

            $category = 'file';
            $placeholder = '📎 [Attachment]';

            // 1. Voice / Audio detection (must take precedence over video because finfo detects .webm as video/webm)
            $isVoice = ($requestedFileType === 'audio')
                || $request->hasFile('audio')
                || str_starts_with($originalName, 'voice_')
                || str_starts_with($mime, 'audio/')
                || in_array($clientExt, ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba', 'opus', 'caf'])
                || ($clientExt === 'webm' && (str_contains($originalName, 'voice') || $requestedFileType === 'audio'));

            if ($isVoice) {
                $category = 'audio';
                $placeholder = '🎤 [Voice Note]';
                $ext = in_array($clientExt, ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4']) ? $clientExt : 'webm';
            } elseif (str_starts_with($mime, 'image/') || in_array($clientExt, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'])) {
                $category = 'image';
                $placeholder = '📷 [Photo]';
                $ext = $clientExt ?: 'jpg';
            } elseif (str_starts_with($mime, 'video/') || in_array($clientExt, ['mp4', 'mov', 'avi', 'mkv', 'webm'])) {
                $category = 'video';
                $placeholder = '🎥 [Video]';
                $ext = $clientExt ?: 'mp4';
            } elseif ($clientExt === 'pdf' || $mime === 'application/pdf') {
                $category = 'file';
                $placeholder = '📄 [PDF Document]';
                $ext = 'pdf';
            } else {
                $category = 'file';
                $placeholder = '📎 [' . ($originalName ?: 'File') . ']';
                $ext = $clientExt ?: 'bin';
            }

            $filename = 'out_' . $category . '_' . uniqid() . '.' . $ext;
            $destDir = public_path('uploads/chat_attachments');
            if (! file_exists($destDir)) {
                mkdir($destDir, 0755, true);
            }
            $uploadedFile->move($destDir, $filename);

            $fileUrl = '/uploads/chat_attachments/' . $filename;
            $fullLocalPath = $destDir . DIRECTORY_SEPARATOR . $filename;

            $attachmentData = [
                'file_url' => $fileUrl,
                'file_type' => $category,
                'file_name' => $originalName,
                'file_size' => file_exists($fullLocalPath) ? filesize($fullLocalPath) : 0,
                'local_path' => $fullLocalPath,
                'placeholder' => $placeholder,
            ];
        } elseif ($mediaId) {
            $media = \App\Models\MediaFile::find($mediaId);
            if ($media) {
                $localPath = public_path($media->file_path);
                $category = $media->file_type === 'document' ? 'file' : $media->file_type;
                $placeholder = match ($media->file_type) {
                    'image' => '📷 [Photo]',
                    'video' => '🎥 [Video]',
                    'audio' => '🎤 [Audio]',
                    default => '📎 [' . ($media->title ?: $media->file_name) . ']',
                };

                $attachmentData = [
                    'file_url' => $media->file_url,
                    'file_type' => $category,
                    'file_name' => $media->file_name,
                    'file_size' => $media->file_size ?: (file_exists($localPath) ? filesize($localPath) : 0),
                    'local_path' => $localPath,
                    'placeholder' => $placeholder,
                ];
            }
        }

        $deliveryError = null;

        $message = DB::transaction(function () use ($conversation, $text, $user, $isNote, $attachmentData, $replyToMessage, &$deliveryError) {
            $displayText = $text;
            if (empty(trim((string) $displayText)) && $attachmentData) {
                $displayText = $attachmentData['placeholder'] ?? '📎 [Attachment]';
            }

            $initialMetadata = [];
            if ($replyToMessage) {
                $senderName = $replyToMessage->sender_type === 'customer'
                    ? ($conversation->customer?->name ?: 'Customer')
                    : ($replyToMessage->senderUser?->name ?: 'Moderator');

                $initialMetadata['reply_to'] = [
                    'id' => $replyToMessage->id,
                    'text' => $replyToMessage->text,
                    'sender_type' => $replyToMessage->sender_type,
                    'sender_name' => $senderName,
                    'message_type' => $replyToMessage->message_type,
                    'created_at' => $replyToMessage->created_at?->toISOString(),
                ];
            }

            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'reply_to_message_id' => $replyToMessage?->id,
                'sender_type' => $isNote ? 'system' : 'moderator',
                'sender_user_id' => $user->id,
                'text' => $displayText,
                'message_type' => $attachmentData ? $attachmentData['file_type'] : 'text',
                'delivery_status' => $isNote ? 'delivered' : 'pending',
                'is_internal_note' => $isNote,
                'sent_at' => now(),
                'platform_message_id' => 'out_' . uniqid(),
                'metadata' => ! empty($initialMetadata) ? $initialMetadata : null,
            ]);

            if ($attachmentData) {
                MessageAttachment::create([
                    'message_id' => $msg->id,
                    'file_url' => $attachmentData['file_url'],
                    'file_type' => $attachmentData['file_type'],
                    'file_name' => $attachmentData['file_name'],
                    'file_size' => $attachmentData['file_size'],
                ]);
            }

            if (! $isNote) {
                // If human reply sent, automatically pause AI mode or set human takeover
                $conversation->update([
                    'last_message_at' => now(),
                    'is_human_takeover' => true,
                    'status' => 'active',
                ]);

                // Dispatch to Meta Graph API if active social account token is present
                $account = $conversation->socialAccount;
                if ($account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
                    $identity = CustomerChannelIdentity::where('social_account_id', $conversation->social_account_id)
                        ->where('customer_id', $conversation->customer_id)
                        ->first();
                    $psid = $identity?->platform_customer_id ?? preg_replace('/^t_(?:ig_|wa_)?/', '', $conversation->channel_conversation_id);
                    $version = config('services.meta.graph_version', 'v19.0');

                    try {
                        if ($account->platform === 'facebook_page' || $account->platform === 'instagram_business') {
                            $pageToken = $account->access_token;

                            // Calculate hours since customer's last message to check 24-hour window
                            $lastCustomerMsg = $conversation->messages()
                                ->where('sender_type', 'customer')
                                ->latest('created_at')
                                ->first();
                            $hoursSinceCustomer = $lastCustomerMsg && $lastCustomerMsg->created_at
                                ? $lastCustomerMsg->created_at->diffInHours(now())
                                : 999;

                            $requestedTag = $request->input('message_tag');
                            if (! in_array($requestedTag, ['POST_PURCHASE_UPDATE', 'HUMAN_AGENT', 'ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE'])) {
                                $requestedTag = null;
                            }

                            // 1. If attachment present, stream binary media to Meta Messenger with smart tag fallback
                            if ($attachmentData && ! empty($attachmentData['local_path']) && file_exists($attachmentData['local_path'])) {
                                $mediaResult = $this->sendMetaMediaMessage(
                                    $version,
                                    $pageToken,
                                    $psid,
                                    $attachmentData,
                                    $account->platform,
                                    $hoursSinceCustomer,
                                    $requestedTag,
                                    $account
                                );

                                if ($mediaResult['success']) {
                                    $data = $mediaResult['data'] ?? [];
                                    $currentMeta = $msg->metadata ?? [];
                                    $currentMeta['tag_used'] = $mediaResult['tag_used'] ?? 'RESPONSE';
                                    $msg->update([
                                        'delivery_status' => 'delivered',
                                        'platform_message_id' => $data['message_id'] ?? $msg->platform_message_id,
                                        'metadata' => $currentMeta,
                                    ]);
                                } else {
                                    $deliveryError = $mediaResult['error'] ?? 'Media upload failed';
                                    $errorCode = $mediaResult['error_code'] ?? null;
                                    Log::error("Meta Send Attachment Error for Conv {$conversation->id} (PSID {$psid}): {$deliveryError}");

                                    $msg->update([
                                        'delivery_status' => 'failed',
                                        'metadata' => [
                                            'error' => $deliveryError,
                                            'error_code' => $errorCode,
                                        ],
                                    ]);

                                    if ($errorCode === 190 || str_contains($deliveryError, 'expired') || str_contains($deliveryError, 'access token')) {
                                        $account->update([
                                            'status' => 'expired',
                                            'last_error' => $deliveryError,
                                        ]);
                                    }
                                }
                            }

                            // 2. If text was also provided, send the text message to Meta with smart tag fallback
                            if (! empty(trim((string) $text))) {
                                $replyMid = ($replyToMessage && $replyToMessage->platform_message_id && ! str_starts_with($replyToMessage->platform_message_id, 'out_'))
                                    ? $replyToMessage->platform_message_id
                                    : null;

                                $textResult = $this->sendMetaTextMessage(
                                    $version,
                                    $pageToken,
                                    $psid,
                                    $text,
                                    $replyMid,
                                    $account->platform,
                                    $hoursSinceCustomer,
                                    $requestedTag,
                                    $account
                                );

                                if ($textResult['success']) {
                                    $data = $textResult['data'] ?? [];
                                    $currentMeta = $msg->metadata ?? [];
                                    $currentMeta['tag_used'] = $textResult['tag_used'] ?? 'RESPONSE';
                                    $msg->update([
                                        'delivery_status' => 'delivered',
                                        'platform_message_id' => $data['message_id'] ?? $msg->platform_message_id,
                                        'metadata' => $currentMeta,
                                    ]);
                                } else {
                                    $deliveryError = $textResult['error'] ?? 'Text send failed';
                                    $errorCode = $textResult['error_code'] ?? null;
                                    Log::error("Meta Send Text Error for Conv {$conversation->id} (PSID {$psid}): {$deliveryError}");

                                    $msg->update([
                                        'delivery_status' => 'failed',
                                        'metadata' => [
                                            'error' => $deliveryError,
                                            'error_code' => $errorCode,
                                        ],
                                    ]);

                                    if ($errorCode === 190 || str_contains($deliveryError, 'expired') || str_contains($deliveryError, 'access token')) {
                                        $account->update([
                                            'status' => 'expired',
                                            'last_error' => $deliveryError,
                                        ]);
                                    }
                                }
                            }
                        } elseif ($account->platform === 'whatsapp_cloud') {
                            $phoneId = $account->account_id;
                            $targetRecipient = preg_replace('/[^0-9]/', '', (string) $psid);
                            $publicUrl = $attachmentData ? url($attachmentData['file_url']) : null;
                            if ($publicUrl) {
                                $waType = match ($attachmentData['file_type']) {
                                    'image' => 'image',
                                    'video' => 'video',
                                    'audio' => 'audio',
                                    default => 'document',
                                };
                                $waPayload = [
                                    'messaging_product' => 'whatsapp',
                                    'to' => $targetRecipient,
                                    'type' => $waType,
                                    $waType => array_filter([
                                        'link' => $publicUrl,
                                        'caption' => ! empty(trim((string) $text)) ? $text : null,
                                        'filename' => $attachmentData['file_name'],
                                    ]),
                                ];
                            } else {
                                $waPayload = [
                                    'messaging_product' => 'whatsapp',
                                    'to' => $targetRecipient,
                                    'type' => 'text',
                                    'text' => ['body' => $text],
                                ];
                            }

                            $res = Http::withToken($account->access_token)
                                ->post("https://graph.facebook.com/{$version}/{$phoneId}/messages", $waPayload);

                            if ($res->successful()) {
                                $data = $res->json();
                                $msg->update([
                                    'delivery_status' => 'delivered',
                                    'platform_message_id' => $data['messages'][0]['id'] ?? $msg->platform_message_id,
                                ]);
                            } else {
                                $deliveryError = $res->json('error.message') ?? $res->body();
                                Log::error('WhatsApp Cloud Send API Error: ' . $deliveryError);
                                $msg->update([
                                    'delivery_status' => 'failed',
                                    'metadata' => ['error' => $deliveryError],
                                ]);
                            }
                        }
                    } catch (\Exception $e) {
                        $deliveryError = $e->getMessage();
                        Log::error('Outbound Message Send Exception: ' . $deliveryError);
                        $msg->update([
                            'delivery_status' => 'failed',
                            'metadata' => ['error' => $deliveryError],
                        ]);
                    }
                } else {
                    $msg->update(['delivery_status' => 'delivered']);
                }
            }

            return $msg;
        });

        $loadRelations = [
            'senderUser:id,name',
            'attachments',
            'replyTo:id,text,sender_type,sender_user_id,message_type,created_at,metadata',
            'replyTo.senderUser:id,name',
        ];

        if ($deliveryError && $message->delivery_status === 'failed') {
            $isExpired = str_contains($deliveryError, 'expired') || str_contains($deliveryError, 'access token');
            $isWindowError = $this->isOutsideAllowedWindowError($errorCode, $deliveryError);

            if ($isExpired) {
                $userFacingMsg = 'Facebook Page access token expired! Please update or reconnect your Facebook Page in Channel Connections.';
            } elseif ($isWindowError) {
                $userFacingMsg = 'মেটা পলিসি (Facebook Messenger): গ্রাহকের শেষ মেসেজের পর ২৪ ঘণ্টার রেসপন্স উইন্ডো শেষ হয়ে গেছে। সিস্টেম স্বয়ংক্রিয়ভাবে মেসেজ ট্যাগ (POST_PURCHASE_UPDATE / HUMAN_AGENT) দিয়ে পাঠানোর চেষ্টা করেছে কিন্তু মেটা তা অনুমোদন করেনি। অনুগ্রহ করে গ্রাহককে পেজে নতুন কোনো বার্তা দিতে বলুন, অথবা এসএমএস/কলের মাধ্যমে যোগাযোগ করুন।';
            } else {
                $userFacingMsg = "Message could not be delivered to Meta Facebook: {$deliveryError}";
            }

            return response()->json([
                'status' => 'failed',
                'message' => $userFacingMsg,
                'delivery_error' => $deliveryError,
                'data' => $message->load($loadRelations),
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Message sent successfully',
            'data' => $message->load($loadRelations),
        ]);
    }

    /**
     * Suggest AI Reply for Moderator.
     */
    public function suggestReply(Request $request, Conversation $conversation): JsonResponse
    {
        $lastCustomerMessage = $conversation->messages()
            ->where('sender_type', 'customer')
            ->latest('created_at')
            ->first();

        $textToAnalyze = $lastCustomerMessage ? $lastCustomerMessage->text : 'Hello, can you help me?';

        // Retrieve product context from lead's related product or channel's first product
        $relatedProduct = $conversation->lead?->relatedProduct;
        if (! $relatedProduct) {
            $relatedProduct = $conversation->socialAccount->products()->first();
        }

        $context = $relatedProduct
            ? ['products' => [$this->knowledgeService->getVerifiedContextForProduct($relatedProduct)]]
            : ['products' => []];

        $aiDecision = $this->aiService->generateStructuredReply(
            $textToAnalyze,
            $context,
            'friendly',
            'suggestion'
        );

        // Record suggestion
        AiSuggestion::create([
            'conversation_id' => $conversation->id,
            'user_id' => $request->user()->id,
            'suggested_text' => $aiDecision['reply_text'],
            'intent' => $aiDecision['intent'],
            'confidence' => $aiDecision['confidence'],
            'tone' => 'friendly',
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'suggested_reply' => $aiDecision['reply_text'],
                'intent' => $aiDecision['intent'],
                'suggested_lead_status' => $aiDecision['suggested_lead_status'],
                'confidence' => $aiDecision['confidence'],
                'product_reference' => $aiDecision['product_reference'],
            ],
        ]);
    }

    /**
     * Toggle Human Takeover or change AI mode.
     */
    public function toggleTakeover(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'is_human_takeover' => 'required|boolean',
            'ai_mode' => 'nullable|in:auto,suggestion_only,human_only',
        ]);

        $conversation->update([
            'is_human_takeover' => $validated['is_human_takeover'],
            'ai_mode' => $validated['ai_mode'] ?? ($validated['is_human_takeover'] ? 'human_only' : 'auto'),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => $conversation->is_human_takeover ? 'Human takeover active (AI auto-replies paused)' : 'AI automation resumed',
            'data' => $conversation,
        ]);
    }

    /**
     * Update conversation status (pending, active, resolved).
     */
    public function updateStatus(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,active,resolved',
        ]);

        $conversation->update(['status' => $validated['status']]);

        return response()->json([
            'status' => 'success',
            'message' => 'Status updated successfully',
            'data' => $conversation,
        ]);
    }

    /**
     * Assign conversation to a moderator.
     */
    public function assign(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'assigned_to_user_id' => 'nullable|exists:users,id',
        ]);

        $conversation->update(['assigned_to_user_id' => $validated['assigned_to_user_id']]);

        return response()->json([
            'status' => 'success',
            'message' => 'Conversation assigned successfully',
            'data' => $conversation->load('assignedUser'),
        ]);
    }

    /**
     * Bulk sync real customer names and profile pictures from Facebook page conversations.
     */
    public function syncNames(): JsonResponse
    {
        $updated = \App\Services\FacebookProfileService::syncAllPagesRecentConversations();

        return response()->json([
            'status' => 'success',
            'message' => "Successfully synced {$updated} customer profile(s) (name & picture) from Facebook.",
            'updated_count' => $updated,
        ]);
    }

    /**
     * Active Synchronization of remote messages from Meta Graph API.
     * Ensures any replies sent from Facebook Page Inbox / Meta Business Suite
     * or messages that arrived while webhook was offline/standby are immediately imported.
     */
    public function syncRemoteMessages(Conversation $conversation): int
    {
        $account = $conversation->socialAccount;
        if (! $account || empty($account->access_token) || str_starts_with($account->access_token, 'EAAXMOCK')) {
            return 0;
        }

        if (! in_array($conversation->platform, ['facebook_page', 'instagram_business'])) {
            return 0;
        }

        $version = config('services.meta.graph_version', 'v21.0');
        $psid = preg_replace('/^t_(?:ig_|wa_)?/', '', $conversation->channel_conversation_id);

        $messages = [];
        $threadId = $conversation->channel_conversation_id;

        // Try direct thread query if thread id is known
        if (! empty($threadId) && str_starts_with($threadId, 't_') && strlen($threadId) > 8) {
            try {
                $httpRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$threadId}/messages", [
                    'fields' => 'id,created_time,from,to,message,attachments',
                    'limit' => 15,
                    'access_token' => $account->access_token,
                ]);
                if ($httpRes->successful()) {
                    $messages = $httpRes->json('data') ?? [];
                }
            } catch (\Throwable $e) {}
        }

        // Fallback: lookup conversation by user PSID
        if (empty($messages)) {
            try {
                $userRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$account->account_id}/conversations", [
                    'user_id' => $psid,
                    'fields' => 'id,messages.limit(15){id,created_time,from,to,message,attachments}',
                    'access_token' => $account->access_token,
                ]);
                if ($userRes->successful()) {
                    $firstConv = $userRes->json('data.0');
                    if (! empty($firstConv['id'])) {
                        if ($conversation->channel_conversation_id !== $firstConv['id']) {
                            $conversation->update(['channel_conversation_id' => $firstConv['id']]);
                        }
                        $messages = $firstConv['messages']['data'] ?? [];
                    }
                }
            } catch (\Throwable $e) {}
        }

        if (empty($messages)) {
            return 0;
        }

        $synced = 0;
        foreach (array_reverse($messages) as $m) {
            $mid = $m['id'] ?? null;
            if (! $mid || Message::where('platform_message_id', $mid)->exists()) {
                continue;
            }

            $fromId = (string) ($m['from']['id'] ?? '');
            $isPage = ($fromId === (string) $account->account_id);
            $senderType = $isPage ? 'moderator' : 'customer';
            $text = $m['message'] ?? '';
            $attachments = $m['attachments']['data'] ?? [];

            $msgType = 'text';
            if (empty(trim((string) $text)) && ! empty($attachments)) {
                $msgType = 'image';
                $text = '📷 [Photo]';
            }

            if (empty(trim((string) $text))) {
                $text = '📎 [Message]';
            }

            $sentAt = isset($m['created_time'])
                ? Carbon::parse($m['created_time'])
                : now();

            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => $senderType,
                'sender_user_id' => null,
                'platform_message_id' => $mid,
                'text' => $text,
                'message_type' => $msgType,
                'delivery_status' => 'delivered',
                'sent_at' => $sentAt,
                'metadata' => $isPage ? ['source' => 'facebook_page_inbox'] : null,
            ]);

            foreach ($attachments as $att) {
                $url = $att['image_data']['url'] ?? ($att['file_url'] ?? null);
                if ($url) {
                    MessageAttachment::create([
                        'message_id' => $msg->id,
                        'file_url' => $url,
                        'file_type' => 'image',
                        'file_name' => 'img_' . substr(md5($url), 0, 8),
                    ]);
                }
            }

            if ($isPage) {
                $conversation->update([
                    'last_message_at' => $sentAt,
                    'unread_count' => 0,
                    'is_human_takeover' => true,
                ]);
            } else {
                $conversation->update([
                    'last_message_at' => $sentAt,
                ]);
            }

            $synced++;
        }

        return $synced;
    }

    /**
     * Force sync endpoint for a single conversation.
     */
    public function sync(Conversation $conversation): JsonResponse
    {
        $count = $this->syncRemoteMessages($conversation);
        $conversation->load([
            'messages' => function ($q) {
                $q->orderBy('created_at', 'asc')->with([
                    'senderUser:id,name',
                    'attachments',
                    'replyTo:id,text,sender_type,sender_user_id,message_type,created_at,metadata',
                    'replyTo.senderUser:id,name',
                ]);
            },
        ]);

        return response()->json([
            'status' => 'success',
            'synced_count' => $count,
            'message' => $count > 0 ? "Synced {$count} new messages from Meta." : "All messages are up to date.",
            'data' => $conversation,
        ]);
    }

    /**
     * Check if error from Meta Graph API is caused by the 24-hour messaging window policy.
     */
    protected function isOutsideAllowedWindowError(?int $code, ?string $message): bool
    {
        if ($code === 10) {
            return true;
        }

        if ($message) {
            $lower = strtolower($message);
            if (
                str_contains($lower, 'outside of allowed window') ||
                str_contains($lower, 'allowed window') ||
                str_contains($lower, 'policy-overview') ||
                str_contains($lower, '2018278') ||
                str_contains($lower, '24 hour') ||
                str_contains($lower, '24-hour')
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get candidate message tags in order of priority based on platform and time elapsed.
     */
    protected function getCandidateMessageTags(string $platform, int $hoursSinceCustomer, ?string $requestedTag = null): array
    {
        if ($platform === 'instagram_business') {
            return ['HUMAN_AGENT'];
        }

        $validFacebookTags = ['POST_PURCHASE_UPDATE', 'HUMAN_AGENT', 'ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE'];

        if ($requestedTag && in_array($requestedTag, $validFacebookTags)) {
            $remaining = array_values(array_diff($validFacebookTags, [$requestedTag]));
            return array_merge([$requestedTag], $remaining);
        }

        // For NexFlow e-commerce CRM:
        // Within 7 days (168 hours): HUMAN_AGENT is the premier human customer service tag.
        // Over 7 days: POST_PURCHASE_UPDATE has no 7-day limit and is ideal for orders, invoices, and shipment info.
        if ($hoursSinceCustomer <= 168) {
            return ['HUMAN_AGENT', 'POST_PURCHASE_UPDATE', 'ACCOUNT_UPDATE'];
        }

        return ['POST_PURCHASE_UPDATE', 'ACCOUNT_UPDATE', 'HUMAN_AGENT'];
    }

    /**
     * Send text message to Meta Graph API with automatic message tag fallback.
     */
    protected function sendMetaTextMessage(
        string $version,
        string $pageToken,
        string $psid,
        string $text,
        ?string $replyToMid,
        string $platform,
        int $hoursSinceCustomer,
        ?string $requestedTag = null,
        ?SocialAccount $account = null
    ): array {
        $cleanReplyMid = ($replyToMid && ! str_starts_with($replyToMid, 'out_')) ? $replyToMid : null;

        $attemptSend = function ($payload, $token) use ($version) {
            return Http::timeout(10)->withToken($token)
                ->post("https://graph.facebook.com/{$version}/me/messages", $payload);
        };

        $refreshTokenIfNeeded = function ($res, &$token) use ($account, $version) {
            if ($account && ! $res->successful() && in_array($res->status(), [400, 401, 403])) {
                $err = $res->json('error.message') ?? '';
                if (str_contains($err, 'OAuthException') || str_contains($err, 'access token') || str_contains($err, 'expired')) {
                    try {
                        $pageRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                            'fields' => 'access_token',
                            'access_token' => $token,
                        ]);
                        if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                            $token = $pageRes->json('access_token');
                            $account->update(['access_token' => $token]);
                            return true;
                        }
                    } catch (\Throwable $e) {}
                }
            }
            return false;
        };

        $lastError = null;
        $lastErrorCode = null;

        // Attempt 1: Standard RESPONSE (if within 24h and no specific tag requested)
        if ($hoursSinceCustomer < 24 && empty($requestedTag)) {
            $payload = [
                'recipient' => ['id' => $psid],
                'messaging_type' => 'RESPONSE',
                'message' => ['text' => $text],
            ];
            if ($cleanReplyMid) {
                $payload['message']['reply_to'] = ['mid' => $cleanReplyMid];
            }

            $res = $attemptSend($payload, $pageToken);

            if (! $res->successful() && isset($payload['message']['reply_to'])) {
                unset($payload['message']['reply_to']);
                $res = $attemptSend($payload, $pageToken);
            }

            if ($refreshTokenIfNeeded($res, $pageToken)) {
                $res = $attemptSend($payload, $pageToken);
            }

            if ($res->successful()) {
                return [
                    'success' => true,
                    'data' => $res->json(),
                    'tag_used' => 'RESPONSE',
                ];
            }

            $lastError = $res->json('error.message') ?? $res->body();
            $lastErrorCode = $res->json('error.code');
            Log::warning("Standard 24h Meta Send failed for PSID {$psid}: {$lastError} (Code: {$lastErrorCode})");

            if (! $this->isOutsideAllowedWindowError($lastErrorCode, $lastError)) {
                return [
                    'success' => false,
                    'error' => $lastError,
                    'error_code' => $lastErrorCode,
                ];
            }
        }

        // Attempt 2+: Candidate Tags (Outside 24h or Tag Requested)
        $candidateTags = $this->getCandidateMessageTags($platform, $hoursSinceCustomer, $requestedTag);

        foreach ($candidateTags as $tag) {
            $taggedPayload = [
                'recipient' => ['id' => $psid],
                'messaging_type' => 'MESSAGE_TAG',
                'tag' => $tag,
                'message' => ['text' => $text],
            ];
            if ($cleanReplyMid) {
                $taggedPayload['message']['reply_to'] = ['mid' => $cleanReplyMid];
            }

            $res = $attemptSend($taggedPayload, $pageToken);

            if (! $res->successful() && isset($taggedPayload['message']['reply_to'])) {
                unset($taggedPayload['message']['reply_to']);
                $res = $attemptSend($taggedPayload, $pageToken);
            }

            if ($refreshTokenIfNeeded($res, $pageToken)) {
                $res = $attemptSend($taggedPayload, $pageToken);
            }

            if ($res->successful()) {
                Log::info("Meta Message delivered successfully using tag {$tag} for PSID {$psid}");
                return [
                    'success' => true,
                    'data' => $res->json(),
                    'tag_used' => $tag,
                ];
            }

            $lastError = $res->json('error.message') ?? $res->body();
            $lastErrorCode = $res->json('error.code');
            Log::warning("Meta Send with tag {$tag} failed for PSID {$psid}: {$lastError} (Code: {$lastErrorCode})");
        }

        return [
            'success' => false,
            'error' => $lastError,
            'error_code' => $lastErrorCode,
        ];
    }

    /**
     * Stream binary media to Meta Graph API with automatic message tag fallback.
     */
    protected function sendMetaMediaMessage(
        string $version,
        string $pageToken,
        string $psid,
        array $attachmentData,
        string $platform,
        int $hoursSinceCustomer,
        ?string $requestedTag = null,
        ?SocialAccount $account = null
    ): array {
        if (empty($attachmentData['local_path']) || ! file_exists($attachmentData['local_path'])) {
            return ['success' => false, 'error' => 'Local attachment file not found', 'error_code' => 404];
        }

        $metaType = in_array($attachmentData['file_type'], ['image', 'video', 'audio', 'file'])
            ? $attachmentData['file_type']
            : 'file';
        $sendFileName = $attachmentData['file_name'];
        if ($metaType === 'audio' && str_ends_with(strtolower($sendFileName), '.webm')) {
            $sendFileName = preg_replace('/\.webm$/i', '.ogg', $sendFileName);
        }

        $attemptMediaSend = function (array $formFields, $token) use ($version, $attachmentData, $sendFileName) {
            $handle = fopen($attachmentData['local_path'], 'r');
            try {
                $res = Http::timeout(50)->withToken($token)
                    ->attach('filedata', $handle, $sendFileName)
                    ->post("https://graph.facebook.com/{$version}/me/messages", $formFields);
                return $res;
            } finally {
                if (is_resource($handle)) {
                    fclose($handle);
                }
            }
        };

        $messagePayload = json_encode([
            'attachment' => [
                'type' => $metaType,
                'payload' => ['is_reusable' => true],
            ],
        ]);

        $lastError = null;
        $lastErrorCode = null;

        // Standard attempt if within 24h
        if ($hoursSinceCustomer < 24 && empty($requestedTag)) {
            $formFields = [
                'recipient' => json_encode(['id' => $psid]),
                'messaging_type' => 'RESPONSE',
                'message' => $messagePayload,
            ];

            $res = $attemptMediaSend($formFields, $pageToken);
            if ($res->successful()) {
                return ['success' => true, 'data' => $res->json(), 'tag_used' => 'RESPONSE'];
            }

            $lastError = $res->json('error.message') ?? $res->body();
            $lastErrorCode = $res->json('error.code');

            if (! $this->isOutsideAllowedWindowError($lastErrorCode, $lastError)) {
                return ['success' => false, 'error' => $lastError, 'error_code' => $lastErrorCode];
            }
        }

        // Tagged attempts
        $candidateTags = $this->getCandidateMessageTags($platform, $hoursSinceCustomer, $requestedTag);
        foreach ($candidateTags as $tag) {
            $formFields = [
                'recipient' => json_encode(['id' => $psid]),
                'messaging_type' => 'MESSAGE_TAG',
                'tag' => $tag,
                'message' => $messagePayload,
            ];

            $res = $attemptMediaSend($formFields, $pageToken);
            if ($res->successful()) {
                Log::info("Meta Attachment delivered successfully using tag {$tag} for PSID {$psid}");
                return ['success' => true, 'data' => $res->json(), 'tag_used' => $tag];
            }

            $lastError = $res->json('error.message') ?? $res->body();
            $lastErrorCode = $res->json('error.code');
            Log::warning("Meta Attachment with tag {$tag} failed: {$lastError}");
        }

        return ['success' => false, 'error' => $lastError, 'error_code' => $lastErrorCode];
    }
}

