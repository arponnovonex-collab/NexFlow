<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\CustomerChannelIdentity;
use App\Models\Message;
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
     */
    public function handleFacebook(Request $request): Response
    {
        $payload = $request->all();

        // 1. Store event for audit and idempotent tracking
        $eventId = $payload['entry'][0]['id'] ?? ('fb_ev_' . uniqid());
        $entryTime = $payload['entry'][0]['time'] ?? time();

        $webhookEvent = WebhookEvent::create([
            'platform' => 'facebook_page',
            'event_id' => $eventId . '_' . $entryTime,
            'event_type' => 'inbound_entry',
            'payload' => $payload,
            'processed' => false,
        ]);

        try {
            $entries = $payload['entry'] ?? [];
            foreach ($entries as $entry) {
                $pageId = $entry['id'] ?? null;
                $account = SocialAccount::where('platform', 'facebook_page')
                    ->where('account_id', (string) $pageId)
                    ->first();

                // Process Feed Changes (Post Comments)
                if (! empty($entry['changes'])) {
                    foreach ($entry['changes'] as $change) {
                        if (($change['field'] ?? '') === 'feed') {
                            $this->processFeedComment($change['value'] ?? [], $account);
                        }
                    }
                }

                // Process Messenger Inbound Messages
                if (! empty($entry['messaging'])) {
                    foreach ($entry['messaging'] as $messagingEvent) {
                        $this->processMessengerEvent($messagingEvent, $account);
                    }
                }
            }

            $webhookEvent->update(['processed' => true, 'processed_at' => now()]);
        } catch (\Exception $e) {
            Log::error('Meta Webhook Processing Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            $webhookEvent->update(['error' => $e->getMessage()]);
        }

        // Always acknowledge Meta with 200 OK immediately
        return response('EVENT_RECEIVED', 200);
    }

    /**
     * Process incoming Facebook Post comments.
     */
    protected function processFeedComment(array $value, ?SocialAccount $account): void
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
                'social_account_id' => $account?->id ?? 1,
                'message' => 'Facebook Post #' . $postId,
                'is_auto_reply_enabled' => true,
                'published_at' => now(),
            ]
        );

        // Store comment
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

        // If post auto reply is enabled and account is active
        if ($post->is_auto_reply_enabled && (! $account || $account->is_active)) {
            $context = $this->knowledgeService->getVerifiedContextForPost($post);
            $aiDecision = $this->aiService->generateStructuredReply(
                $message,
                $context,
                $post->reply_tone ?? 'friendly',
                'comment_reply'
            );

            $replyText = $aiDecision['reply_text'];

            // Update comment record
            $comment->update([
                'intent' => $aiDecision['intent'],
                'reply_status' => 'replied',
                'reply_text' => $replyText,
            ]);

            // If account has valid live token, publish to Graph API
            if ($account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
                $version = config('services.meta.graph_version', 'v19.0');
                $publishRes = Http::post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                    'message' => $replyText,
                    'access_token' => $account->access_token,
                ]);

                // Fallback: If 400/403 (e.g. token was User token instead of Page token), resolve Page token and retry
                if (! $publishRes->successful() && ($publishRes->status() === 400 || $publishRes->status() === 403)) {
                    Log::warning("Comment reply failed for {$commentId} with status {$publishRes->status()}. Attempting to resolve Page token...");
                    $pageRes = Http::get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                        'fields' => 'access_token',
                        'access_token' => $account->access_token,
                    ]);
                    if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                        $pageToken = $pageRes->json('access_token');
                        $account->update(['access_token' => $pageToken]);
                        $publishRes = Http::post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                            'message' => $replyText,
                            'access_token' => $pageToken,
                        ]);
                    }
                }

                Log::info("Published comment reply for comment {$commentId}: status " . $publishRes->status() . " body: " . $publishRes->body());
            }
        }
    }

    /**
     * Process incoming Facebook Messenger messages.
     */
    protected function processMessengerEvent(array $event, ?SocialAccount $account): void
    {
        $senderPsid = $event['sender']['id'] ?? null;
        $messageObj = $event['message'] ?? null;

        if (! $senderPsid || ! $messageObj || empty($messageObj['text'])) {
            return;
        }

        $text = $messageObj['text'];
        $mid = $messageObj['mid'] ?? ('mid_' . uniqid());

        // Check if customer channel identity already exists
        $identity = CustomerChannelIdentity::where('social_account_id', $account?->id ?? 1)
            ->where('platform', 'facebook_page')
            ->where('platform_customer_id', (string) $senderPsid)
            ->first();

        $customer = $identity?->customer;

        // Fetch real Facebook name and profile picture from Graph API
        $profileName = $customer?->name;
        $avatarUrl = $customer?->avatar_url;
        $needsProfileFetch = ! $customer || str_starts_with($customer->name, 'Facebook Customer');

        if ($needsProfileFetch && $account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
            try {
                $version = config('services.meta.graph_version', 'v19.0');
                $profileRes = Http::timeout(5)->get("https://graph.facebook.com/{$version}/{$senderPsid}", [
                    'fields' => 'name,first_name,last_name,profile_pic',
                    'access_token' => $account->access_token,
                ]);

                if ($profileRes->successful()) {
                    $profileData = $profileRes->json();
                    if (! empty($profileData['name'])) {
                        $profileName = $profileData['name'];
                    }
                    if (! empty($profileData['profile_pic'])) {
                        $avatarUrl = $profileData['profile_pic'];
                    }
                }
            } catch (\Exception $e) {
                Log::warning('Failed to fetch FB profile for PSID ' . $senderPsid . ': ' . $e->getMessage());
            }
        }

        if (! $profileName) {
            $profileName = 'Facebook Customer (' . substr($senderPsid, -4) . ')';
        }
        if (! $avatarUrl) {
            $avatarUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80';
        }

        if (! $customer) {
            $customer = Customer::create([
                'name' => $profileName,
                'avatar_url' => $avatarUrl,
            ]);

            $identity = CustomerChannelIdentity::create([
                'social_account_id' => $account?->id ?? 1,
                'platform' => 'facebook_page',
                'platform_customer_id' => (string) $senderPsid,
                'customer_id' => $customer->id,
                'profile_name' => $profileName,
            ]);
        } else {
            // Update customer with verified name and profile picture
            $customer->update([
                'name' => $profileName,
                'avatar_url' => $avatarUrl,
            ]);
            $identity->update([
                'profile_name' => $profileName,
            ]);
        }

        // Find or create conversation
        $conversation = Conversation::firstOrCreate(
            [
                'social_account_id' => $account?->id ?? 1,
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

        // Store customer message
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_type' => 'customer',
            'platform_message_id' => $mid,
            'text' => $text,
            'message_type' => 'text',
            'delivery_status' => 'delivered',
            'sent_at' => now(),
        ]);

        $conversation->update([
            'last_message_at' => now(),
            'unread_count' => $conversation->unread_count + 1,
        ]);

        // Auto-reply if AI is enabled and human takeover is false
        if (! $conversation->is_human_takeover && $conversation->ai_mode === 'auto') {
            $relatedProduct = $conversation->socialAccount?->products()->first();
            $context = $relatedProduct
                ? ['products' => [$this->knowledgeService->getVerifiedContextForProduct($relatedProduct)]]
                : ['products' => []];

            $aiDecision = $this->aiService->generateStructuredReply(
                $text,
                $context,
                'friendly',
                'message_reply'
            );

            $replyText = $aiDecision['reply_text'];

            // Store AI response
            Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => 'ai',
                'platform_message_id' => 'ai_' . uniqid(),
                'text' => $replyText,
                'message_type' => 'text',
                'delivery_status' => 'sent',
                'sent_at' => now(),
            ]);

            // If account has live token, send via official Send API
            if ($account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
                $version = config('services.meta.graph_version', 'v19.0');
                $sendRes = Http::post("https://graph.facebook.com/{$version}/me/messages", [
                    'recipient' => ['id' => $senderPsid],
                    'message' => ['text' => $replyText],
                    'access_token' => $account->access_token,
                ]);

                // Fallback: If 400/403, resolve Page token and retry
                if (! $sendRes->successful() && ($sendRes->status() === 400 || $sendRes->status() === 403)) {
                    Log::warning("Messenger send failed for {$senderPsid} with status {$sendRes->status()}. Attempting to resolve Page token...");
                    $pageRes = Http::get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                        'fields' => 'access_token',
                        'access_token' => $account->access_token,
                    ]);
                    if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                        $pageToken = $pageRes->json('access_token');
                        $account->update(['access_token' => $pageToken]);
                        Http::post("https://graph.facebook.com/{$version}/me/messages", [
                            'recipient' => ['id' => $senderPsid],
                            'message' => ['text' => $replyText],
                            'access_token' => $pageToken,
                        ]);
                    }
                }
            }
        }
    }
}

