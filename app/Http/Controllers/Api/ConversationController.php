<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiSuggestion;
use App\Models\Conversation;
use App\Models\ConversationNote;
use App\Models\ConversationTag;
use App\Models\Lead;
use App\Models\LeadStatusHistory;
use App\Models\Message;
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
            'socialAccount:id,platform,name,username,status',
            'assignedUser:id,name,role',
            'lead.relatedProduct',
            'tags',
            'notes.user:id,name',
            'messages' => function ($q) {
                $q->orderBy('created_at', 'asc')->with(['senderUser:id,name', 'attachments']);
            },
        ]);

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
     * Send a message from moderator.
     */
    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'text' => 'required|string',
            'is_internal_note' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $isNote = $validated['is_internal_note'] ?? false;

        $message = DB::transaction(function () use ($conversation, $validated, $user, $isNote) {
            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => $isNote ? 'system' : 'moderator',
                'sender_user_id' => $user->id,
                'text' => $validated['text'],
                'message_type' => 'text',
                'delivery_status' => $isNote ? 'delivered' : 'pending',
                'is_internal_note' => $isNote,
                'sent_at' => now(),
                'platform_message_id' => 'out_' . uniqid(),
            ]);

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
                    $psid = preg_replace('/^t_/', '', $conversation->channel_conversation_id);
                    $version = config('services.meta.graph_version', 'v19.0');

                    try {
                        if ($account->platform === 'facebook_page' || $account->platform === 'instagram_business') {
                            $res = Http::post("https://graph.facebook.com/{$version}/me/messages", [
                                'recipient' => ['id' => $psid],
                                'message' => ['text' => $validated['text']],
                                'access_token' => $account->access_token,
                            ]);

                            if ($res->successful()) {
                                $data = $res->json();
                                $msg->update([
                                    'delivery_status' => 'delivered',
                                    'platform_message_id' => $data['message_id'] ?? $msg->platform_message_id,
                                ]);
                            } else {
                                Log::error('Meta Send API Error: ' . $res->body());
                                $msg->update(['delivery_status' => 'failed']);
                            }
                        } elseif ($account->platform === 'whatsapp_cloud') {
                            $phoneId = $account->account_id;
                            $res = Http::withToken($account->access_token)
                                ->post("https://graph.facebook.com/{$version}/{$phoneId}/messages", [
                                    'messaging_product' => 'whatsapp',
                                    'to' => $psid,
                                    'type' => 'text',
                                    'text' => ['body' => $validated['text']],
                                ]);

                            if ($res->successful()) {
                                $data = $res->json();
                                $msg->update([
                                    'delivery_status' => 'delivered',
                                    'platform_message_id' => $data['messages'][0]['id'] ?? $msg->platform_message_id,
                                ]);
                            } else {
                                Log::error('WhatsApp Cloud Send API Error: ' . $res->body());
                                $msg->update(['delivery_status' => 'failed']);
                            }
                        }
                    } catch (\Exception $e) {
                        Log::error('Outbound Message Send Exception: ' . $e->getMessage());
                        $msg->update(['delivery_status' => 'failed']);
                    }
                } else {
                    $msg->update(['delivery_status' => 'delivered']);
                }
            }

            return $msg;
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Message sent successfully',
            'data' => $message->load('senderUser'),
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
}

