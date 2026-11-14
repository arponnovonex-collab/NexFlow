<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiSetting;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\CustomerChannelIdentity;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Product;
use App\Models\SocialAccount;
use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Models\WebhookEvent;
use App\Services\OpenAIService;
use App\Services\ProductKnowledgeService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetaWebhookController extends Controller
{
    public function __construct(
        protected ProductKnowledgeService $knowledgeService,
        protected OpenAIService $aiService
    ) {}

    /**
     * Webhook Challenge Verification for Facebook & Instagram.
     * Meta sends: ?hub.mode=subscribe&hub.challenge=XXXX&hub.verify_token=YYYY
     */
    public function verify(Request $request): Response
    {
        $mode = $request->input('hub_mode', $request->input('hub.mode'));
        $token = $request->input('hub_verify_token', $request->input('hub.verify_token'));
        $challenge = $request->input('hub_challenge', $request->input('hub.challenge'));

        $expectedToken = config('services.meta.verify_token', 'nexflow_secure_webhook_token_2026');

        if ($mode === 'subscribe' && $token === $expectedToken) {
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response('Forbidden: Verification token mismatch', 403);
    }

    /**
     * Handle incoming Facebook events (Comments & Messenger DMs).
     * Ultra-smooth architecture: Saves incoming data instantly, flushes HTTP 200 to Meta in < 50ms,
     * and performs AI generation & profile enrichment asynchronously.
     */
    public function handleFacebook(Request $request): Response
    {
        $payload = $request->all();

        // 1. Audit event
        $eventId = $payload['entry'][0]['id'] ?? ('fb_ev_' . uniqid());
        $entryTime = $payload['entry'][0]['time'] ?? time();

        $platform = 'facebook_page';
        if (($payload['object'] ?? '') === 'whatsapp_business_account' || $request->is('*whatsapp*')) {
            $platform = 'whatsapp_cloud';
        } elseif (($payload['object'] ?? '') === 'instagram' || $request->is('*instagram*')) {
            $platform = 'instagram_business';
        }

        $webhookEvent = WebhookEvent::create([
            'platform' => $platform,
            'event_id' => $eventId . '_' . $entryTime,
            'event_type' => 'inbound_entry',
            'payload' => $payload,
            'processed' => false,
        ]);

        $pendingMessengerTasks = [];
        $pendingCommentTasks = [];

        try {
            $entries = $payload['entry'] ?? [];
            foreach ($entries as $entry) {
                $pageId = $entry['id'] ?? null;
                $account = SocialAccount::whereIn('platform', ['facebook_page', 'instagram_business'])
                    ->where('account_id', (string) $pageId)
                    ->first();

                // Process Feed Changes (Post Comments) - Instant DB storage
                if (! empty($entry['changes'])) {
                    foreach ($entry['changes'] as $change) {
                        if (($change['field'] ?? '') === 'feed') {
                            $this->processFeedCommentInstant($change['value'] ?? [], $account, $pendingCommentTasks);
                        } elseif (($change['field'] ?? '') === 'messages') {
                            $this->processWhatsAppChangeInstant($change['value'] ?? [], $pendingMessengerTasks);
                        }
                    }
                }

                // Process Messenger Inbound Messages & Standby Events (Handover Protocol / Page Inbox Echoes)
                $messagingEvents = array_merge(
                    $entry['messaging'] ?? [],
                    $entry['standby'] ?? []
                );

                if (! empty($messagingEvents)) {
                    foreach ($messagingEvents as $messagingEvent) {
                        $this->processMessengerEventInstant($messagingEvent, $account, $pendingMessengerTasks);
                    }
                }
            }

            $webhookEvent->update(['processed' => true, 'processed_at' => now()]);
        } catch (\Throwable $e) {
            Log::error('Meta Webhook Inbound Storage Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            $webhookEvent->update(['error' => $e->getMessage()]);
        }

        // Flush HTTP 200 OK immediately to Meta so Meta never times out or retries!
        if (function_exists('fastcgi_finish_request')) {
            echo 'EVENT_RECEIVED';
            fastcgi_finish_request();
        }

        // 2. Perform AI responses and profile enrichments in background (non-blocking)
        foreach ($pendingMessengerTasks as $task) {
            try {
                $this->executeMessengerTask($task);
            } catch (\Throwable $e) {
                Log::error('Messenger Background Task Error: ' . $e->getMessage());
            }
        }

        foreach ($pendingCommentTasks as $task) {
            try {
                $this->executeCommentTask($task);
            } catch (\Throwable $e) {
                Log::error('Comment Background Task Error: ' . $e->getMessage());
            }
        }

        return response('EVENT_RECEIVED', 200);
    }

    /**
     * Process incoming Facebook Post comments instantly.
     */
    protected function processFeedCommentInstant(array $value, ?SocialAccount $account, array &$pendingTasks): void
    {
        $item = $value['item'] ?? '';
        $verb = $value['verb'] ?? '';

        if ($item !== 'comment' || $verb !== 'add') {
            return;
        }

        $commentId = $value['comment_id'] ?? null;
        $postId = $value['post_id'] ?? null;
        $message = $value['message'] ?? '';
        $fromId = $value['from']['id'] ?? null;
        $fromName = $value['from']['name'] ?? 'Facebook User';

        // Check if comment is posted by the page itself (moderator reply directly on Facebook post)
        if ($account && (string) $fromId === (string) $account->account_id) {
            $parentId = $value['parent_id'] ?? null;
            if ($parentId && (string) $parentId !== (string) $postId) {
                $parentComment = SocialComment::where('platform_comment_id', (string) $parentId)->first();
                if ($parentComment) {
                    $parentComment->update([
                        'reply_status' => 'replied',
                        'reply_text' => $message,
                    ]);
                }
            }
            return;
        }

        // Find or create social post
        $post = SocialPost::firstOrCreate(
            ['platform_post_id' => (string) $postId],
            [
                'social_account_id' => $account?->id ?? 12,
                'message' => 'Facebook Post #' . $postId,
                'is_auto_reply_enabled' => true,
                'published_at' => now(),
            ]
        );

        // Store comment immediately
        $comment = SocialComment::updateOrCreate(
            [
                'social_post_id' => $post->id,
                'platform_comment_id' => (string) $commentId,
            ],
            [
                'customer_name' => $fromName,
                'platform_user_id' => (string) $fromId,
                'message' => $message,
                'reply_status' => 'unanswered',
            ]
        );

        $pendingTasks[] = [
            'comment' => $comment,
            'post' => $post,
            'account' => $account,
            'comment_id' => $commentId,
            'message' => $message,
        ];
    }

    /**
     * Execute comment AI auto-reply and private DM.
     */
    protected function executeCommentTask(array $task): void
    {
        $comment = $task['comment'];
        $post = $task['post'];
        $account = $task['account'];
        $commentId = $task['comment_id'];
        $message = $task['message'];

        $commentAutoReplyEnabled = AiSetting::getBool('comment_auto_reply_enabled', true);
        $channelAiAllowed = ! $account || ($account->settings['ai_mode'] ?? 'auto') !== 'paused';

        if (! $commentAutoReplyEnabled || ! $channelAiAllowed || ! $post->is_auto_reply_enabled || ($account && ! $account->is_active)) {
            return;
        }

        $context = $this->knowledgeService->getVerifiedContextForPost($post);
        $aiDecision = $this->aiService->generateStructuredReply(
            $message,
            $context,
            $post->reply_tone ?? 'friendly',
            'comment_reply'
        );

        $replyText = $aiDecision['reply_text'];

        $comment->update([
            'intent' => $aiDecision['intent'],
            'reply_status' => 'replied',
            'reply_text' => $replyText,
        ]);

        if ($account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
            $version = config('services.meta.graph_version', 'v19.0');

            // 1. Send Public Comment Reply
            $publishRes = Http::timeout(6)->withToken($account->access_token)
                ->post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                    'message' => $replyText,
                ]);

            if (! $publishRes->successful() && in_array($publishRes->status(), [400, 403])) {
                $pageRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                    'fields' => 'access_token',
                    'access_token' => $account->access_token,
                ]);
                if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                    $pageToken = $pageRes->json('access_token');
                    $account->update(['access_token' => $pageToken]);
                    Http::timeout(6)->withToken($pageToken)->post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                        'message' => $replyText,
                    ]);
                }
            }

            // 2. Send Private Message (DM) to customer's Messenger inbox
            try {
                $tokenToUse = $account->fresh()->access_token;
                Http::timeout(6)->withToken($tokenToUse)->post("https://graph.facebook.com/{$version}/me/messages", [
                    'recipient' => ['comment_id' => (string) $commentId],
                    'message' => ['text' => $replyText],
                ]);
            } catch (\Throwable $e) {
                Log::warning("Private Reply Exception for comment {$commentId}: " . $e->getMessage());
            }
        }
    }

    /**
     * Process incoming Facebook Messenger messages with INSTANT database storage.
     * Supports both inbound customer messages AND page moderator replies (message_echoes)
     * sent from Facebook Page Inbox / Meta Business Suite / Messenger mobile app.
     */
    protected function processMessengerEventInstant(array $event, ?SocialAccount $account, array &$pendingTasks): void
    {
        $senderPsid = $event['sender']['id'] ?? null;
        $recipientId = $event['recipient']['id'] ?? null;
        $messageObj = $event['message'] ?? null;

        if (! $senderPsid || ! $messageObj) {
            return;
        }

        // 1. Detect if this is an echo event (message sent by the Page / Moderator from Facebook Page Inbox, Meta Business Suite, or Messenger app)
        $isEcho = ! empty($messageObj['is_echo']);

        // Fallback: If not explicitly flagged as is_echo, check if sender matches this account or ANY connected page account
        if (! $isEcho) {
            if ($account && (string) $senderPsid === (string) $account->account_id) {
                $isEcho = true;
            } else {
                $senderPage = SocialAccount::where('account_id', (string) $senderPsid)->first();
                if ($senderPage) {
                    $isEcho = true;
                    $account = $senderPage;
                }
            }
        }

        // 2. Resolve customer PSID and Page account
        if ($isEcho) {
            $pageId = (string) $senderPsid;
            $customerPsid = (string) $recipientId;
            if (! $account) {
                $account = SocialAccount::where('account_id', $pageId)->first();
            }
        } else {
            $customerPsid = (string) $senderPsid;
            if (! $account && $recipientId) {
                $account = SocialAccount::where('account_id', (string) $recipientId)->first();
            }
        }

        if (! $account) {
            $account = SocialAccount::where('platform', 'facebook_page')->where('is_active', true)->first();
        }

        // 3. Extract message text, supporting attachments, voice notes, stickers, and quick replies
        $text = $messageObj['text'] ?? '';
        $attachments = $messageObj['attachments'] ?? [];
        if (empty(trim((string) $text))) {
            if (! empty($attachments)) {
                $firstType = $attachments[0]['type'] ?? 'attachment';
                $text = match ($firstType) {
                    'image' => '📷 [Photo]',
                    'audio' => '🎤 [Voice Message]',
                    'video' => '🎥 [Video]',
                    'file' => '📄 [Document]',
                    default => '📎 [Attachment]',
                };
            } elseif (! empty($messageObj['sticker_id'])) {
                $text = '👍 [Sticker]';
            } elseif (! empty($messageObj['quick_reply']['payload'])) {
                $text = $messageObj['quick_reply']['payload'];
            }
        }

        if (empty(trim((string) $text))) {
            return;
        }

        // 4. Idempotent check: prevent duplicate message records on Meta retries or CRM-originated sends
        $mid = $messageObj['mid'] ?? ('mid_' . uniqid());
        if (Message::where('platform_message_id', $mid)->exists()) {
            return;
        }

        // 5. Resilient Customer & Channel Identity creation (concurrent-safe)
        $accountId = $account?->id ?? 12;
        $platform = $account?->platform ?? 'facebook_page';
        $identity = CustomerChannelIdentity::where('platform', $platform)
            ->where('platform_customer_id', (string) $customerPsid)
            ->first();

        if ($identity) {
            $customer = $identity->customer;
        } else {
            // Check if user previously commented on a post with their real name
            $commentAuthor = SocialComment::where('platform_user_id', (string) $customerPsid)
                ->whereNotNull('customer_name')
                ->where('customer_name', '!=', '')
                ->where('customer_name', '!=', 'Facebook User')
                ->latest()
                ->value('customer_name');

            $initialName = $commentAuthor ?: (
                $platform === 'instagram_business'
                    ? ('Instagram User (' . substr($customerPsid, -4) . ')')
                    : ('Facebook Customer (' . substr($customerPsid, -4) . ')')
            );

            $customer = Customer::create([
                'name' => $initialName,
                'avatar_url' => null,
            ]);

            try {
                $identity = CustomerChannelIdentity::create([
                    'social_account_id' => $accountId,
                    'platform' => $platform,
                    'platform_customer_id' => (string) $customerPsid,
                    'customer_id' => $customer->id,
                    'profile_name' => $customer->name,
                ]);
            } catch (\Throwable $e) {
                // If created concurrently by duplicate webhook delivery, retrieve it
                $identity = CustomerChannelIdentity::where('platform', $platform)
                    ->where('platform_customer_id', (string) $customerPsid)
                    ->first();
                if ($identity && $identity->customer) {
                    $customer = $identity->customer;
                }
            }
        }

        if (! $customer) {
            return;
        }

        // 6. Find or create conversation
        $conversation = Conversation::firstOrCreate(
            [
                'social_account_id' => $accountId,
                'customer_id' => $customer->id,
                'platform' => $platform,
            ],
            [
                'channel_conversation_id' => 't_' . $customerPsid,
                'status' => 'active',
                'ai_mode' => 'auto',
                'is_human_takeover' => false,
                'last_message_at' => now(),
            ]
        );

        // 7. Store message immediately (< 5ms)
        $msgType = 'text';
        if (! empty($attachments)) {
            $firstType = $attachments[0]['type'] ?? 'file';
            $msgType = match ($firstType) {
                'image' => 'image',
                'video' => 'video',
                'audio' => 'audio',
                'file' => 'file',
                default => 'attachment',
            };
        }

        $sentAt = isset($event['timestamp'])
            ? Carbon::createFromTimestampMs($event['timestamp'])
            : now();

        $senderType = $isEcho ? 'moderator' : 'customer';

        $msg = Message::create([
            'conversation_id' => $conversation->id,
            'sender_type' => $senderType,
            'sender_user_id' => null, // Sent directly from Facebook Page Inbox / Meta Business Suite
            'platform_message_id' => $mid,
            'text' => $text,
            'message_type' => $msgType,
            'delivery_status' => 'delivered',
            'sent_at' => $sentAt,
            'metadata' => $isEcho ? [
                'source' => 'facebook_page_inbox',
                'app_id' => $messageObj['app_id'] ?? null,
            ] : null,
        ]);

        if (! empty($attachments)) {
            foreach ($attachments as $att) {
                $fileUrl = $att['payload']['url'] ?? null;
                $fileType = $att['type'] ?? 'image';
                if ($fileUrl) {
                    MessageAttachment::create([
                        'message_id' => $msg->id,
                        'file_url' => $fileUrl,
                        'file_type' => $fileType,
                        'file_name' => $fileType . '_' . substr(md5($fileUrl), 0, 8),
                    ]);
                }
            }
        }

        if ($isEcho) {
            // Human moderator replied directly from Facebook Page Inbox / Meta Business Suite
            // Clear unread count, update last_message_at, and enable human takeover so AI pauses!
            $conversation->update([
                'last_message_at' => $sentAt,
                'unread_count' => 0,
                'is_human_takeover' => true,
                'status' => 'active',
            ]);
            // Do NOT queue for AI reply since this was an outbound reply by the Page moderator
        } else {
            // Customer inbound message
            $conversation->update([
                'last_message_at' => $sentAt,
                'unread_count' => $conversation->unread_count + 1,
            ]);

            // Queue for background profile enrichment and AI auto-reply
            $pendingTasks[] = [
                'type' => 'messenger',
                'conversation' => $conversation,
                'customer' => $customer,
                'account' => $account,
                'sender_psid' => (string) $customerPsid,
                'text' => $text,
            ];
        }
    }

    /**
     * Execute Messenger background tasks: profile name fetch & AI auto-reply.
     */
    protected function executeMessengerTask(array $task): void
    {
        /** @var Conversation $conversation */
        $conversation = $task['conversation'];
        /** @var Customer $customer */
        $customer = $task['customer'];
        /** @var SocialAccount|null $account */
        $account = $task['account'];
        $senderPsid = $task['sender_psid'];
        $text = $task['text'];

        // 1. Fast profile enrichment if name is generic or profile pic is missing
        if (str_starts_with($customer->name, 'Facebook Customer') || empty($customer->avatar_url)) {
            try {
                \App\Services\FacebookProfileService::resolveCustomerName($account, (string) $senderPsid, $customer);
            } catch (\Throwable $e) {
                Log::warning('Error resolving customer real name & avatar: ' . $e->getMessage());
            }
        }

        // 2. Check AI control switches
        $messengerAutoReplyEnabled = AiSetting::getBool('messenger_auto_reply_enabled', true);
        $channelAiAllowed = ! $account || ($account->settings['ai_mode'] ?? 'auto') !== 'paused';

        // Auto-resume AI if moderator has been silent for > 30 minutes
        if ($conversation->is_human_takeover && $conversation->last_message_at && $conversation->last_message_at->lt(now()->subMinutes(30))) {
            $conversation->update([
                'is_human_takeover' => false,
                'ai_mode' => 'auto',
            ]);
        }

        if (! $messengerAutoReplyEnabled || ! $channelAiAllowed || $conversation->is_human_takeover || $conversation->ai_mode !== 'auto') {
            return;
        }

        // 3. Generate structured AI reply
        $products = $conversation->socialAccount?->products()->get();
        if (! $products || $products->isEmpty()) {
            $products = Product::where('is_active', true)->limit(5)->get();
        }

        $productContexts = $products->map(function ($p) {
            return $this->knowledgeService->getVerifiedContextForProduct($p);
        })->toArray();

        $context = ['products' => $productContexts];

        $aiDecision = $this->aiService->generateStructuredReply(
            $text,
            $context,
            'friendly',
            'message_reply'
        );

        $replyText = $aiDecision['reply_text'];

        // 4. Store AI response
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_type' => 'ai',
            'platform_message_id' => 'ai_' . uniqid(),
            'text' => $replyText,
            'message_type' => 'text',
            'delivery_status' => 'sent',
            'sent_at' => now(),
        ]);

        // 5. Send via Meta Graph API
        if ($account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
            $version = config('services.meta.graph_version', 'v19.0');
            $sendRes = Http::timeout(8)->withToken($account->access_token)
                ->post("https://graph.facebook.com/{$version}/me/messages", [
                    'recipient' => ['id' => $senderPsid],
                    'messaging_type' => 'RESPONSE',
                    'message' => ['text' => $replyText],
                ]);

            if (! $sendRes->successful()) {
                $err = $sendRes->json('error.message') ?? '';
                $code = $sendRes->json('error.code');
                $tokenToUse = $account->fresh()->access_token ?? $account->access_token;

                // Fallback 1: Token refresh if 400 or 403
                if (in_array($sendRes->status(), [400, 403]) && (str_contains($err, 'OAuthException') || str_contains($err, 'access token'))) {
                    $pageRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                        'fields' => 'access_token',
                        'access_token' => $tokenToUse,
                    ]);
                    if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                        $tokenToUse = $pageRes->json('access_token');
                        $account->update(['access_token' => $tokenToUse]);
                        $sendRes = Http::timeout(8)->withToken($tokenToUse)->post("https://graph.facebook.com/{$version}/me/messages", [
                            'recipient' => ['id' => $senderPsid],
                            'messaging_type' => 'RESPONSE',
                            'message' => ['text' => $replyText],
                        ]);
                    }
                }

                // Fallback 2: Outside 24-hour window tag fallback
                if (! $sendRes->successful()) {
                    $err = $sendRes->json('error.message') ?? '';
                    $code = $sendRes->json('error.code');
                    if ($code === 10 || str_contains(strtolower($err), 'outside of allowed window') || str_contains(strtolower($err), 'allowed window')) {
                        $fallbackTags = $account->platform === 'instagram_business' ? ['HUMAN_AGENT'] : ['POST_PURCHASE_UPDATE', 'HUMAN_AGENT', 'ACCOUNT_UPDATE'];
                        foreach ($fallbackTags as $fbTag) {
                            $tagRes = Http::timeout(8)->withToken($tokenToUse)->post("https://graph.facebook.com/{$version}/me/messages", [
                                'recipient' => ['id' => $senderPsid],
                                'messaging_type' => 'MESSAGE_TAG',
                                'tag' => $fbTag,
                                'message' => ['text' => $replyText],
                            ]);
                            if ($tagRes->successful()) {
                                Log::info("Webhook AI auto-reply delivered using tag {$fbTag} for PSID {$senderPsid}");
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Process incoming WhatsApp Cloud API messages and status updates.
     */
    protected function processWhatsAppChangeInstant(array $value, array &$pendingTasks): void
    {
        $phoneId = $value['metadata']['phone_number_id'] ?? null;
        if (! $phoneId) {
            return;
        }

        $account = SocialAccount::where('platform', 'whatsapp_cloud')
            ->where('account_id', (string) $phoneId)
            ->first();

        if (! $account) {
            $displayPhone = $value['metadata']['display_phone_number'] ?? null;
            if ($displayPhone) {
                $account = SocialAccount::where('platform', 'whatsapp_cloud')
                    ->where('username', 'like', "%{$displayPhone}%")
                    ->first();
            }
        }

        // Fallback to active WhatsApp account if test or unmapped phoneId was used
        if (! $account) {
            $account = SocialAccount::where('platform', 'whatsapp_cloud')->first()
                ?: SocialAccount::first();
        }

        $contacts = $value['contacts'] ?? [];
        $contactMap = [];
        foreach ($contacts as $c) {
            $contactMap[$c['wa_id']] = $c['profile']['name'] ?? null;
        }

        $messages = $value['messages'] ?? [];
        foreach ($messages as $msg) {
            $fromWaId = $msg['from'] ?? null; // e.g. 88017xxxxxxxx
            $msgId = $msg['id'] ?? null;
            $msgType = $msg['type'] ?? 'text';
            $msgText = '';

            if ($msgType === 'text') {
                $msgText = $msg['text']['body'] ?? '';
            } elseif ($msgType === 'image') {
                $msgText = $msg['image']['caption'] ?? '📷 [Photo]';
            } elseif ($msgType === 'audio' || $msgType === 'voice') {
                $msgText = '🎤 [Voice Note]';
            } elseif ($msgType === 'video') {
                $msgText = $msg['video']['caption'] ?? '🎥 [Video]';
            } elseif ($msgType === 'document') {
                $msgText = $msg['document']['filename'] ?? '📄 [Document]';
            } else {
                $msgText = "📎 [{$msgType}]";
            }

            if (! $fromWaId || ! $msgId) {
                continue;
            }

            // Deduplicate if already saved
            if (Message::where('platform_message_id', $msgId)->exists()) {
                continue;
            }

            $customerName = $contactMap[$fromWaId] ?? "WhatsApp Customer (+{$fromWaId})";
            $cleanPhone = '+' . ltrim($fromWaId, '+');

            // Find or create Customer
            $customer = Customer::where('phone', $cleanPhone)
                ->orWhere('phone', $fromWaId)
                ->first();

            if (! $customer) {
                $customer = Customer::create([
                    'name' => $customerName,
                    'phone' => $cleanPhone,
                ]);
            } elseif (str_starts_with($customer->name, 'WhatsApp Customer') && ! empty($contactMap[$fromWaId])) {
                $customer->update(['name' => $contactMap[$fromWaId]]);
            }

            // Find or create Channel Identity
            if ($account) {
                CustomerChannelIdentity::firstOrCreate(
                    [
                        'customer_id' => $customer->id,
                        'social_account_id' => $account->id,
                        'platform' => 'whatsapp_cloud',
                        'platform_customer_id' => $fromWaId,
                    ],
                    [
                        'profile_name' => $customerName,
                    ]
                );
            }

            // Find or create Conversation
            $channelConvId = 't_wa_' . $fromWaId;
            $conversation = Conversation::where('channel_conversation_id', $channelConvId)
                ->orWhere(function ($q) use ($account, $customer) {
                    if ($account) {
                        $q->where('social_account_id', $account->id)->where('customer_id', $customer->id);
                    }
                })
                ->first();

            if (! $conversation) {
                $conversation = Conversation::create([
                    'social_account_id' => $account ? $account->id : (SocialAccount::where('platform', 'whatsapp_cloud')->value('id') ?: SocialAccount::value('id')),
                    'customer_id' => $customer->id,
                    'platform' => 'whatsapp_cloud',
                    'channel_conversation_id' => $channelConvId,
                    'status' => 'pending',
                    'ai_mode' => 'auto',
                    'is_human_takeover' => false,
                    'last_message_at' => now(),
                    'unread_count' => 1,
                ]);
            } else {
                $conversation->increment('unread_count');
                $conversation->update(['last_message_at' => now()]);
            }

            // Store Message
            Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => 'customer',
                'platform_message_id' => $msgId,
                'text' => $msgText,
                'message_type' => $msgType === 'text' ? 'text' : 'attachment',
                'delivery_status' => 'delivered',
                'sent_at' => now(),
                'metadata' => [
                    'source' => 'whatsapp_cloud',
                    'wa_id' => $fromWaId,
                ],
            ]);
        }
    }
}
