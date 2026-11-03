<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommentReply;
use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Services\OpenAIService;
use App\Services\ProductKnowledgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $posts = $query->orderByDesc('published_at')->paginate($request->integer('per_page', 15));

        return response()->json([
            'status' => 'success',
            'data' => $posts,
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
        $query = SocialComment::with(['post.products:id,name,selling_price', 'replies']);

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

        return response()->json([
            'status' => 'success',
            'message' => 'Comment reply published successfully',
            'comment' => $comment->fresh(),
        ]);
    }
}

