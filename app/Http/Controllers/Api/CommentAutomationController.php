<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiSetting;
use App\Models\CommentReply;
use App\Models\SocialAccount;
use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Services\OpenAIService;
use App\Services\ProductKnowledgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CommentAutomationController extends Controller
{
    public function __construct(
        protected ProductKnowledgeService $knowledgeService,
        protected OpenAIService $aiService
    ) {}

    /**
     * List all social posts with mapped products and comment counts.
     */
    public function posts(Request $request): JsonResponse
    {
        $query = SocialPost::with(['socialAccount:id,name,platform', 'products:id,name,sku,selling_price'])
            ->withCount(['comments']);

        if ($request->filled('social_account_id')) {
            $query->where('social_account_id', $request->social_account_id);
        }

        $posts = $query->orderByDesc('published_at')->paginate($request->integer('per_page', 50));

        // On-the-fly enrichment for up to 6 incomplete posts on the active page
        $version = config('services.meta.graph_version', 'v19.0');
        $incomplete = $posts->filter(function ($p) {
            return str_starts_with((string) $p->message, 'Facebook Post #') || empty($p->media_url);
        })->take(6);

        foreach ($incomplete as $p) {
            $account = $p->socialAccount;
            if ($account && ! empty($account->access_token) && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
                try {
                    $res = Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$p->platform_post_id}", [
                        'fields' => 'id,message,story,description,created_time,full_picture,picture,permalink_url,status_type,attachments{media,media_type,type,url,unshimmed_url,subattachments,title,description}',
                        'access_token' => $account->access_token,
                    ]);
                    if ($res->successful()) {
                        $extracted = self::extractPostFields($res->json(), $p->platform_post_id);
                        $p->update([
                            'message' => $extracted['message'],
                            'media_url' => $extracted['media_url'] ?: $p->media_url,
                            'permalink' => $extracted['permalink'] ?: $p->permalink,
                            'published_at' => $extracted['published_at'] ?: $p->published_at,
                        ]);
                    }
                } catch (\Throwable $e) {}
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => $posts,
        ]);
    }

    /**
     * Extract rich post fields from Facebook Graph API payload (message, media_url, permalink, published_at).
     */
    public static function extractPostFields(array $item, ?string $fallbackId = null): array
    {
        $id = (string) ($item['id'] ?? $fallbackId ?? '');
        $attachments = $item['attachments']['data'] ?? [];
        $firstAttachment = $attachments[0] ?? null;

        // 1. Caption / Message extraction
        $message = ! empty($item['message']) ? trim($item['message']) : null;
        if (empty($message) && ! empty($firstAttachment['description'])) {
            $message = trim($firstAttachment['description']);
        }
        if (empty($message) && ! empty($firstAttachment['title'])) {
            $message = trim($firstAttachment['title']);
        }
        if (empty($message) && ! empty($item['story'])) {
            $message = trim($item['story']);
        }
        if (empty($message) && ! empty($item['description'])) {
            $message = trim($item['description']);
        }
        if (empty($message)) {
            $message = 'Facebook Post #' . $id;
        }

        // 2. Media Image / Video Thumbnail extraction
        $mediaUrl = $item['full_picture'] ?? null;
        if (empty($mediaUrl) && ! empty($firstAttachment['media']['image']['src'])) {
            $mediaUrl = $firstAttachment['media']['image']['src'];
        }
        if (empty($mediaUrl) && ! empty($firstAttachment['subattachments']['data'][0]['media']['image']['src'])) {
            $mediaUrl = $firstAttachment['subattachments']['data'][0]['media']['image']['src'];
        }
        if (empty($mediaUrl) && ! empty($item['picture'])) {
            $mediaUrl = $item['picture'];
        }

        // 3. Permalink extraction
        $permalink = $item['permalink_url'] ?? null;
        if (empty($permalink) && ! empty($firstAttachment['url'])) {
            $permalink = $firstAttachment['url'];
        }
        if (empty($permalink) && ! empty($firstAttachment['unshimmed_url'])) {
            $permalink = $firstAttachment['unshimmed_url'];
        }

        // 4. Published time
        $publishedAt = isset($item['created_time']) ? Carbon::parse($item['created_time']) : now();

        return [
            'message' => $message,
            'media_url' => $mediaUrl,
            'permalink' => $permalink,
            'published_at' => $publishedAt,
        ];
    }

    /**
     * Sync published posts from connected Facebook pages.
     */
    public function syncPosts(Request $request): JsonResponse
    {
        $version = config('services.meta.graph_version', 'v19.0');
        $query = SocialAccount::where('status', 'connected')->where('platform', 'facebook_page');

        if ($request->filled('social_account_id')) {
            $query->where('id', $request->social_account_id);
        }

        $accounts = $query->get();
        $syncedCount = 0;

        foreach ($accounts as $account) {
            if (! $account->access_token || str_starts_with($account->access_token, 'EAAXMOCK')) {
                continue;
            }

            try {
                $token = $account->access_token;
                $endpointUrl = "https://graph.facebook.com/{$version}/{$account->account_id}/published_posts";
                $postFields = 'id,message,story,created_time,full_picture,picture,permalink_url,status_type,attachments{media,media_type,type,url,unshimmed_url,subattachments,title,description}';
                $queryParams = [
                    'fields' => $postFields,
                    'limit' => 50,
                    'access_token' => $token,
                ];

                $res = Http::timeout(12)->get($endpointUrl, $queryParams);

                // Fallback if token was User token
                if (! $res->successful() && ($res->status() === 400 || $res->status() === 403)) {
                    $pageRes = Http::get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                        'fields' => 'access_token',
                        'access_token' => $token,
                    ]);
                    if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                        $token = $pageRes->json('access_token');
                        $account->update(['access_token' => $token]);
                        $queryParams['access_token'] = $token;
                        $res = Http::timeout(12)->get($endpointUrl, $queryParams);
                    }
                }

                $pagesFetched = 0;
                while ($endpointUrl && $pagesFetched < 10) {
                    if ($pagesFetched > 0) {
                        $res = Http::timeout(15)->get($endpointUrl, $queryParams);
                    }

                    if (! $res->successful()) {
                        break;
                    }

                    $items = $res->json('data') ?? [];
                    if (empty($items)) {
                        break;
                    }

                    foreach ($items as $item) {
                        $extracted = self::extractPostFields($item);
                        SocialPost::updateOrCreate(
                            ['platform_post_id' => (string) $item['id']],
                            [
                                'social_account_id' => $account->id,
                                'message' => $extracted['message'],
                                'media_url' => $extracted['media_url'],
                                'permalink' => $extracted['permalink'],
                                'published_at' => $extracted['published_at'],
                                'is_auto_reply_enabled' => true,
                            ]
                        );
                        $syncedCount++;
                    }

                    $endpointUrl = $res->json('paging.next') ?? null;
                    $queryParams = []; // next URL already includes access token & pagination cursor
                    $pagesFetched++;
                }

                // Also sync standalone Page Videos & Reels that may not appear in published_posts
                try {
                    $vidRes = Http::timeout(12)->get("https://graph.facebook.com/{$version}/{$account->account_id}/videos", [
                        'fields' => 'id,description,title,picture,permalink_url,created_time',
                        'limit' => 30,
                        'access_token' => $token,
                    ]);
                    if ($vidRes->successful()) {
                        $vids = $vidRes->json('data') ?? [];
                        foreach ($vids as $v) {
                            $vId = (string) $v['id'];
                            $vCaption = ! empty($v['description']) ? trim($v['description']) : (! empty($v['title']) ? trim($v['title']) : 'Facebook Video #' . $vId);
                            $vPic = $v['picture'] ?? null;
                            $vLink = $v['permalink_url'] ?? null;
                            $vTime = isset($v['created_time']) ? Carbon::parse($v['created_time']) : now();

                            SocialPost::updateOrCreate(
                                ['platform_post_id' => $vId],
                                [
                                    'social_account_id' => $account->id,
                                    'message' => $vCaption,
                                    'media_url' => $vPic,
                                    'permalink' => $vLink,
                                    'published_at' => $vTime,
                                    'is_auto_reply_enabled' => true,
                                ]
                            );
                            $syncedCount++;
                        }
                    }
                } catch (\Throwable $vidEx) {
                    Log::warning("Video sync skipped for account {$account->id}: " . $vidEx->getMessage());
                }

                // Enrich any existing incomplete posts for this account
                $incompletePosts = SocialPost::where('social_account_id', $account->id)
                    ->where(function ($q) {
                        $q->where('message', 'LIKE', 'Facebook Post #%')
                            ->orWhereNull('media_url')
                            ->orWhere('media_url', '');
                    })
                    ->take(30)
                    ->get();

                foreach ($incompletePosts as $incPost) {
                    try {
                        $singleRes = Http::timeout(8)->get("https://graph.facebook.com/{$version}/{$incPost->platform_post_id}", [
                            'fields' => $postFields,
                            'access_token' => $token,
                        ]);
                        if ($singleRes->successful()) {
                            $extracted = self::extractPostFields($singleRes->json(), $incPost->platform_post_id);
                            $incPost->update([
                                'message' => $extracted['message'],
                                'media_url' => $extracted['media_url'] ?: $incPost->media_url,
                                'permalink' => $extracted['permalink'] ?: $incPost->permalink,
                                'published_at' => $extracted['published_at'] ?: $incPost->published_at,
                            ]);
                            $syncedCount++;
                        }
                    } catch (\Throwable $e) {}
                }
            } catch (\Exception $e) {
                Log::warning("Failed to sync posts for account {$account->id}: " . $e->getMessage());
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Successfully synchronized {$syncedCount} posts from Facebook.",
            'synced_count' => $syncedCount,
        ]);
    }

    /**
     * Update post automation settings and assigned products.
     */
    public function updatePost(Request $request, SocialPost $post): JsonResponse
    {
        $validated = $request->validate([
            'is_auto_reply_enabled' => 'nullable|boolean',
            'reply_tone' => 'nullable|in:friendly,professional,sales_focused',
            'manual_approval_required' => 'nullable|boolean',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'exists:products,id',
        ]);

        $post->update($validated);

        if (isset($validated['product_ids'])) {
            $post->products()->sync($validated['product_ids']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Post settings updated successfully',
            'post' => $post->load(['products', 'socialAccount']),
        ]);
    }

    /**
     * List comments with filters.
     */
    public function comments(Request $request): JsonResponse
    {
        $query = SocialComment::with(['post.products:id,name,selling_price', 'post.socialAccount:id,name,platform', 'replies']);

        if ($request->filled('social_post_id')) {
            $query->where('social_post_id', $request->social_post_id);
        }

        if ($request->filled('reply_status')) {
            $query->where('reply_status', $request->reply_status);
        }

        $comments = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

        return response()->json([
            'status' => 'success',
            'data' => $comments,
        ]);
    }

    /**
     * Generate an AI reply for a comment and save or publish it.
     */
    public function replyToComment(Request $request, SocialComment $comment): JsonResponse
    {
        $post = $comment->post;
        $context = $this->knowledgeService->getVerifiedContextForPost($post);

        $aiDecision = $this->aiService->generateStructuredReply(
            $comment->message,
            $context,
            $post->reply_tone ?? 'friendly',
            'comment_reply'
        );

        $replyText = $aiDecision['reply_text'];

        // Determine if auto publish or manual approval
        $status = $post->manual_approval_required ? 'draft' : 'published';

        $comment->update([
            'intent' => $aiDecision['intent'],
            'reply_status' => $status === 'published' ? 'replied' : 'requires_approval',
            'reply_text' => $replyText,
        ]);

        $reply = CommentReply::create([
            'social_comment_id' => $comment->id,
            'reply_text' => $replyText,
            'sender_type' => 'ai',
            'status' => $status,
            'platform_reply_id' => 'mock_fb_reply_' . uniqid(),
        ]);

        // Publish live to Meta Graph API if active connection
        $account = $post->socialAccount;
        if ($status === 'published' && $account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
            $version = config('services.meta.graph_version', 'v19.0');
            $commentId = $comment->platform_comment_id;
            if ($commentId) {
                try {
                    $publishRes = Http::withToken($account->access_token)
                        ->post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                            'message' => $replyText,
                        ]);

                    if (! $publishRes->successful() && ($publishRes->status() === 400 || $publishRes->status() === 403)) {
                        $pageRes = Http::get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                            'fields' => 'access_token',
                            'access_token' => $account->access_token,
                        ]);
                        if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                            $pageToken = $pageRes->json('access_token');
                            $account->update(['access_token' => $pageToken]);
                            $publishRes = Http::withToken($pageToken)->post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                                'message' => $replyText,
                            ]);
                        }
                    }

                    // Also send Private Messenger Reply (DM)
                    try {
                        $tokenToUse = $account->fresh()->access_token;
                        Http::withToken($tokenToUse)->post("https://graph.facebook.com/{$version}/me/messages", [
                            'recipient' => ['comment_id' => (string) $commentId],
                            'message' => ['text' => $replyText],
                        ]);
                    } catch (\Exception $dmE) {
                        Log::warning('Private reply exception: ' . $dmE->getMessage());
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to publish manual comment reply to FB: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => $status === 'published' ? 'Comment replied successfully' : 'Draft created for approval',
            'data' => [
                'comment' => $comment->fresh(),
                'reply' => $reply,
                'ai_decision' => $aiDecision,
            ],
        ]);
    }

    /**
     * Approve and publish a draft reply.
     */
    public function approveReply(Request $request, SocialComment $comment): JsonResponse
    {
        $validated = $request->validate([
            'reply_text' => 'required|string',
        ]);

        $comment->update([
            'reply_status' => 'replied',
            'reply_text' => $validated['reply_text'],
        ]);

        CommentReply::create([
            'social_comment_id' => $comment->id,
            'reply_text' => $validated['reply_text'],
            'sender_type' => 'moderator',
            'user_id' => $request->user()->id,
            'status' => 'published',
            'platform_reply_id' => 'pub_reply_' . uniqid(),
        ]);

        // Publish live to Meta Graph API if active connection
        $account = $comment->post?->socialAccount;
        if ($account && $account->access_token && ! str_starts_with($account->access_token, 'EAAXMOCK')) {
            $version = config('services.meta.graph_version', 'v19.0');
            $commentId = $comment->platform_comment_id;
            if ($commentId) {
                try {
                    $publishRes = Http::withToken($account->access_token)
                        ->post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                            'message' => $validated['reply_text'],
                        ]);

                    if (! $publishRes->successful() && ($publishRes->status() === 400 || $publishRes->status() === 403)) {
                        $pageRes = Http::get("https://graph.facebook.com/{$version}/{$account->account_id}", [
                            'fields' => 'access_token',
                            'access_token' => $account->access_token,
                        ]);
                        if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                            $pageToken = $pageRes->json('access_token');
                            $account->update(['access_token' => $pageToken]);
                            $publishRes = Http::withToken($pageToken)->post("https://graph.facebook.com/{$version}/{$commentId}/comments", [
                                'message' => $validated['reply_text'],
                            ]);
                        }
                    }

                    // Also send Private Messenger Reply (DM)
                    try {
                        $tokenToUse = $account->fresh()->access_token;
                        Http::withToken($tokenToUse)->post("https://graph.facebook.com/{$version}/me/messages", [
                            'recipient' => ['comment_id' => (string) $commentId],
                            'message' => ['text' => $validated['reply_text']],
                        ]);
                    } catch (\Exception $dmE) {
                        Log::warning('Private reply exception on approve: ' . $dmE->getMessage());
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to publish approved comment reply to FB: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Comment reply published successfully',
            'comment' => $comment->fresh(),
        ]);
    }

    /**
     * Get dedicated AI instructions for Facebook comment replies.
     */
    public function getCommentInstructions(): JsonResponse
    {
        $instructions = AiSetting::where('key', 'comment_ai_instructions')->value('value') ?? '';

        return response()->json([
            'status' => 'success',
            'data' => [
                'instructions' => $instructions,
            ],
        ]);
    }

    /**
     * Update dedicated AI instructions for Facebook comment replies.
     */
    public function updateCommentInstructions(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'instructions' => 'nullable|string',
        ]);

        AiSetting::updateOrCreate(
            ['key' => 'comment_ai_instructions'],
            [
                'value' => $validated['instructions'] ?? '',
                'description' => 'Dedicated custom prompt instructions for Facebook comment replies',
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Comment reply AI instructions updated successfully!',
            'data' => [
                'instructions' => $validated['instructions'] ?? '',
            ],
        ]);
    }
}

