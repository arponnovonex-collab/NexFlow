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
        }

        // Search customer name, phone, message text
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('customer', function ($cq) use ($search) {
                    $cq->where('name', 'like', "%{$search}%")
                       ->orWhere('phone', 'like', "%{$search}%");
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
        $conversation->load([
            'customer.channelIdentities',
            'socialAccount',
            'assignedUser:id,name,role',
            'lead.relatedProduct',
            'tags',
            'notes.user:id,name',
            'messages' => function ($q) {
                $q->orderBy('created_at', 'asc')->with(['senderUser:id,name', 'attachments']);
            },
        ]);

        // Auto-enrich customer profile if still named 'Facebook Customer'
        if ($conversation->platform === 'facebook_page' && $conversation->customer && str_starts_with($conversation->customer->name, 'Facebook Customer')) {
            $psid = str_replace('t_', '', $conversation->channel_conversation_id);
            \App\Services\FacebookProfileService::resolveCustomerName($conversation->socialAccount, $psid, $conversation->customer);
            $conversation->load('customer');
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

        // Reset unread count when opened
        $conversation->update(['unread_count' => 0]);

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
        $afterId = $request->query('after_id');
        $query = $conversation->messages()
            ->with(['senderUser:id,name', 'attachments'])
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
     * Send a message from moderator (supports optional photo attachment).
     */
    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'text' => 'nullable|string',
            'is_internal_note' => 'nullable',
            'image' => 'nullable|file|mimes:jpeg,jpg,png,gif,webp|max:10240', // 10MB max
        ]);

        $user = $request->user();
        $isNote = filter_var($request->input('is_internal_note'), FILTER_VALIDATE_BOOLEAN);
        $text = $request->input('text');
        $hasImage = $request->hasFile('image');

        if (empty(trim((string) $text)) && ! $hasImage) {
            return response()->json([
                'status' => 'error',
                'message' => 'Please enter a message or select an image to send.',
            ], 422);
        }

        $attachmentData = null;
        if ($hasImage) {
            $file = $request->file('image');
            $extension = $file->getClientOriginalExtension() ?: 'jpg';
            $filename = 'out_img_' . uniqid() . '.' . $extension;

            $destDir = public_path('uploads/chat_attachments');
            if (! file_exists($destDir)) {
                mkdir($destDir, 0755, true);
            }
            $file->move($destDir, $filename);

            $fileUrl = '/uploads/chat_attachments/' . $filename;
            $fullLocalPath = $destDir . DIRECTORY_SEPARATOR . $filename;

            $attachmentData = [
                'file_url' => $fileUrl,
                'file_type' => 'image',
                'file_name' => $file->getClientOriginalName(),
                'file_size' => file_exists($fullLocalPath) ? filesize($fullLocalPath) : 0,
                'local_path' => $fullLocalPath,
            ];
        }

        $deliveryError = null;

        $message = DB::transaction(function () use ($conversation, $text, $user, $isNote, $attachmentData, &$deliveryError) {
            $displayText = $text;
            if (empty(trim((string) $displayText)) && $attachmentData) {
                $displayText = '📷 [Photo]';
            }

            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => $isNote ? 'system' : 'moderator',
                'sender_user_id' => $user->id,
                'text' => $displayText,
                'message_type' => $attachmentData ? 'image' : 'text',
                'delivery_status' => $isNote ? 'delivered' : 'pending',
                'is_internal_note' => $isNote,
                'sent_at' => now(),
                'platform_message_id' => 'out_' . uniqid(),
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

                            // 1. If image attachment present, stream binary image to Facebook Messenger
                            if ($attachmentData && ! empty($attachmentData['local_path']) && file_exists($attachmentData['local_path'])) {
                                $handle = fopen($attachmentData['local_path'], 'r');
                                $imageRes = Http::timeout(25)->withToken($pageToken)
                                    ->attach('filedata', $handle, basename($attachmentData['local_path']))
                                    ->post("https://graph.facebook.com/{$version}/me/messages", [
                                        'recipient' => json_encode(['id' => $psid]),
                                        'message' => json_encode([
                                            'attachment' => [
                                                'type' => 'image',
                                                'payload' => [
                                                    'is_reusable' => true,
                                                ],
                                            ],
                                        ]),
                                    ]);

                                if (is_resource($handle)) {
                                    fclose($handle);
                                }

                                // Fallback: If 400 or 403, attempt to resolve Page token from Page ID
                                if (! $imageRes->successful() && in_array($imageRes->status(), [400, 403])) {
                                    $pageRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                                        'fields' => 'access_token',
                                        'access_token' => $pageToken,
                                    ]);
                                    if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                                        $pageToken = $pageRes->json('access_token');
                                        $account->update(['access_token' => $pageToken]);

                                        $retryHandle = fopen($attachmentData['local_path'], 'r');
                                        $imageRes = Http::timeout(25)->withToken($pageToken)
                                            ->attach('filedata', $retryHandle, basename($attachmentData['local_path']))
                                            ->post("https://graph.facebook.com/{$version}/me/messages", [
                                                'recipient' => json_encode(['id' => $psid]),
                                                'message' => json_encode([
                                                    'attachment' => [
                                                        'type' => 'image',
                                                        'payload' => [
                                                            'is_reusable' => true,
                                                        ],
                                                    ],
                                                ]),
                                            ]);
                                        if (is_resource($retryHandle)) {
                                            fclose($retryHandle);
                                        }
                                    }
                                }

                                if ($imageRes->successful()) {
                                    $data = $imageRes->json();
                                    $msg->update([
                                        'delivery_status' => 'delivered',
                                        'platform_message_id' => $data['message_id'] ?? $msg->platform_message_id,
                                    ]);
                                } else {
                                    $errData = $imageRes->json('error');
                                    $deliveryError = $errData['message'] ?? $imageRes->body();
                                    $errorCode = $errData['code'] ?? null;
                                    Log::error("Meta Send Image Attachment Error for Conv {$conversation->id} (PSID {$psid}): {$deliveryError}");

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

                            // 2. If text was also provided, send the text message to Meta
                            if (! empty(trim((string) $text))) {
                                $textRes = Http::timeout(8)->withToken($pageToken)
                                    ->post("https://graph.facebook.com/{$version}/me/messages", [
                                        'recipient' => ['id' => $psid],
                                        'messaging_type' => 'RESPONSE',
                                        'message' => ['text' => $text],
                                    ]);

                                if (! $textRes->successful() && in_array($textRes->status(), [400, 403])) {
                                    $pageRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                                        'fields' => 'access_token',
                                        'access_token' => $pageToken,
                                    ]);
                                    if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                                        $pageToken = $pageRes->json('access_token');
                                        $account->update(['access_token' => $pageToken]);
                                        $textRes = Http::timeout(8)->withToken($pageToken)
                                            ->post("https://graph.facebook.com/{$version}/me/messages", [
                                                'recipient' => ['id' => $psid],
                                                'messaging_type' => 'RESPONSE',
                                                'message' => ['text' => $text],
                                            ]);
                                    }
                                }

                                if ($textRes->successful()) {
                                    $data = $textRes->json();
                                    $msg->update([
                                        'delivery_status' => 'delivered',
                                        'platform_message_id' => $data['message_id'] ?? $msg->platform_message_id,
                                    ]);
                                } else {
                                    $errData = $textRes->json('error');
                                    $deliveryError = $errData['message'] ?? $textRes->body();
                                    $errorCode = $errData['code'] ?? null;
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
                            $publicUrl = $attachmentData ? url($attachmentData['file_url']) : null;
                            if ($publicUrl) {
                                $waPayload = [
                                    'messaging_product' => 'whatsapp',
                                    'to' => $psid,
                                    'type' => 'image',
                                    'image' => array_filter([
                                        'link' => $publicUrl,
                                        'caption' => ! empty(trim((string) $text)) ? $text : null,
                                    ]),
                                ];
                            } else {
                                $waPayload = [
                                    'messaging_product' => 'whatsapp',
                                    'to' => $psid,
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

        if ($deliveryError && $message->delivery_status === 'failed') {
            $isExpired = str_contains($deliveryError, 'expired') || str_contains($deliveryError, 'access token');
            $userFacingMsg = $isExpired
                ? 'Facebook Page access token expired! Please update or reconnect your Facebook Page in Channel Connections.'
                : "Message could not be delivered to Meta Facebook: {$deliveryError}";

            return response()->json([
                'status' => 'failed',
                'message' => $userFacingMsg,
                'delivery_error' => $deliveryError,
                'data' => $message->load(['senderUser:id,name', 'attachments']),
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Message sent successfully',
            'data' => $message->load(['senderUser:id,name', 'attachments']),
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
     * Bulk sync real customer names from Facebook page conversations.
     */
    public function syncNames(): JsonResponse
    {
        $updated = \App\Services\FacebookProfileService::syncAllPagesRecentConversations();

        return response()->json([
            'status' => 'success',
            'message' => "Successfully synced {$updated} customer name(s) from Facebook.",
            'updated_count' => $updated,
        ]);
    }
}

