<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiSetting;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\CustomerChannelIdentity;
use App\Models\Message;
use App\Models\Product;
use App\Models\SocialAccount;
use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Models\WebhookEvent;
use App\Services\OpenAIService;
use App\Services\ProductKnowledgeService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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

        $webhookEvent = WebhookEvent::create([
            'platform' => 'facebook_page',
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
                $account = SocialAccount::where('platform', 'facebook_page')
                    ->where('account_id', (string) $pageId)
                    ->first();

                // Process Feed Changes (Post Comments) - Instant DB storage
                if (! empty($entry['changes'])) {
                    foreach ($entry['changes'] as $change) {
                        if (($change['field'] ?? '') === 'feed') {
                            $this->processFeedCommentInstant($change['value'] ?? [], $account, $pendingCommentTasks);
                        }
                    }
                }

                // Process Messenger Inbound Messages - Instant DB storage
                if (! empty($entry['messaging'])) {
                    foreach ($entry['messaging'] as $messagingEvent) {
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

        // Check if comment is posted by the page itself to avoid loops
        if ($account && (string) $fromId === (string) $account->account_id) {
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
     */
    protected function processMessengerEventInstant(array $event, ?SocialAccount $account, array &$pendingTasks): void
    {
        $senderPsid = $event['sender']['id'] ?? null;
        $recipientId = $event['recipient']['id'] ?? null;
        $messageObj = $event['message'] ?? null;

        if (! $senderPsid || ! $messageObj) {
            return;
        }

        // 1. Ignore echo events (sent by the page or moderator)
        if (! empty($messageObj['is_echo'])) {
            return;
        }

        // 2. Ignore messages where sender is the page itself to avoid loops
        if ($account && (string) $senderPsid === (string) $account->account_id) {
            return;
        }

        // 3. Fallback account lookup if not resolved by entry ID
        if (! $account && $recipientId) {
            $account = SocialAccount::where('account_id', (string) $recipientId)->first();
        }
        if (! $account) {
            $account = SocialAccount::where('platform', 'facebook_page')->where('is_active', true)->first();
        }

        // 4. Extract message text, supporting attachments, voice notes, stickers, and quick replies
        $text = $messageObj['text'] ?? '';
        $attachments = $messageObj['attachments'] ?? [];
        if (empty(trim((string) $text))) {
            if (! empty($attachments)) {
                $firstType = $attachments[0]['type'] ?? 'attachment';
                $text = match ($firstType) {
                    'image' => '📷 [Photo]',
                    'audio' => '🎤 [Voice Message]',
                    'video' => '🎥 [Video]',
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

        // 5. Idempotent check: prevent duplicate message records on Meta retries
        $mid = $messageObj['mid'] ?? ('mid_' . uniqid());
        if (Message::where('platform_message_id', $mid)->exists()) {
            return;
        }

        // 6. Resilient Customer & Channel Identity creation (concurrent-safe)
        $accountId = $account?->id ?? 12;
        $identity = CustomerChannelIdentity::where('platform', 'facebook_page')
            ->where('platform_customer_id', (string) $senderPsid)
            ->first();

        if ($identity) {
            $customer = $identity->customer;
        } else {
            // Check if user previously commented on a post with their real name
            $commentAuthor = SocialComment::where('platform_user_id', (string) $senderPsid)
                ->whereNotNull('customer_name')
                ->where('customer_name', '!=', '')
                ->where('customer_name', '!=', 'Facebook User')
                ->latest()
                ->value('customer_name');

            $initialName = $commentAuthor ?: ('Facebook Customer (' . substr($senderPsid, -4) . ')');

            $customer = Customer::create([
                'name' => $initialName,
                'avatar_url' => 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80',
            ]);

            try {
                $identity = CustomerChannelIdentity::create([
                    'social_account_id' => $accountId,
                    'platform' => 'facebook_page',
                    'platform_customer_id' => (string) $senderPsid,
                    'customer_id' => $customer->id,
                    'profile_name' => $customer->name,
                ]);
            } catch (\Throwable $e) {
                // If created concurrently by duplicate webhook delivery, retrieve it
                $identity = CustomerChannelIdentity::where('platform', 'facebook_page')
                    ->where('platform_customer_id', (string) $senderPsid)
                    ->first();
                if ($identity && $identity->customer) {
                    $customer = $identity->customer;
                }
            }
        }

        if (! $customer) {
            return;
        }

        // 7. Find or create conversation
        $conversation = Conversation::firstOrCreate(
            [
                'social_account_id' => $accountId,
                'customer_id' => $customer->id,
                'platform' => 'facebook_page',
            ],
            [
                'channel_conversation_id' => 't_' . $senderPsid,
                'status' => 'active',
                'ai_mode' => 'auto',
                'is_human_takeover' => false,
                'last_message_at' => now(),
            ]
        );

        // 8. Store customer message IMMEDIATELY (< 5ms)
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_type' => 'customer',
            'platform_message_id' => $mid,
            'text' => $text,
            'message_type' => ! empty($attachments) ? 'attachment' : 'text',
            'delivery_status' => 'delivered',
            'sent_at' => now(),
        ]);

        $conversation->update([
            'last_message_at' => now(),
            'unread_count' => $conversation->unread_count + 1,
        ]);

        // Queue for background profile enrichment and AI auto-reply
        $pendingTasks[] = [
            'type' => 'messenger',
            'conversation' => $conversation,
            'customer' => $customer,
            'account' => $account,
            'sender_psid' => (string) $senderPsid,
            'text' => $text,
        ];
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

        // 1. Fast profile enrichment if name is generic
        if (str_starts_with($customer->name, 'Facebook Customer')) {
            try {
                \App\Services\FacebookProfileService::resolveCustomerName($account, (string) $senderPsid, $customer);
            } catch (\Throwable $e) {
                Log::warning('Error resolving customer real name: ' . $e->getMessage());
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

            if (! $sendRes->successful() && in_array($sendRes->status(), [400, 403])) {
                $pageRes = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                    'fields' => 'access_token',
                    'access_token' => $account->access_token,
                ]);
                if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                    $pageToken = $pageRes->json('access_token');
                    $account->update(['access_token' => $pageToken]);
                    Http::timeout(8)->withToken($pageToken)->post("https://graph.facebook.com/{$version}/me/messages", [
                        'recipient' => ['id' => $senderPsid],
                        'messaging_type' => 'RESPONSE',
                        'message' => ['text' => $replyText],
                    ]);
                }
            }
        }
    }
}
