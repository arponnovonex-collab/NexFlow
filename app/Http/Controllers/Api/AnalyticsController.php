<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AiUsageLog;
use App\Models\CommentReply;
use App\Models\Conversation;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\Message;
use App\Models\User;
use App\Models\WebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Get moderator performance metrics.
     */
    public function moderatorPerformance(Request $request): JsonResponse
    {
        $targetDate = $request->filled('date')
            ? Carbon::parse($request->date)->toDateString()
            : today()->toDateString();

        $moderators = User::whereIn('role', ['moderator', 'admin'])
            ->withCount(['assignedConversations', 'assignedLeads'])
            ->get()
            ->map(function ($mod) use ($targetDate) {
                // Messages sent on the specific date
                $messagesSentOnDate = Message::where('sender_user_id', $mod->id)
                    ->whereDate('created_at', $targetDate)
                    ->count();

                // Unique conversations/customers replied to on the specific date
                $customersHandledOnDate = Message::where('sender_user_id', $mod->id)
                    ->whereDate('created_at', $targetDate)
                    ->distinct('conversation_id')
                    ->count('conversation_id');

                // Facebook comments replied on the specific date
                $commentsRepliedOnDate = CommentReply::where('user_id', $mod->id)
                    ->whereDate('created_at', $targetDate)
                    ->count();

                // Total unique customers handled all-time
                $totalCustomersHandled = Message::where('sender_user_id', $mod->id)
                    ->distinct('conversation_id')
                    ->count('conversation_id');

                $allTimeMessagesSent = Message::where('sender_user_id', $mod->id)->count();
                $converted = Lead::where('assigned_to_user_id', $mod->id)->where('status', 'converted')->count();
                $followupsCompleted = LeadFollowup::where('user_id', $mod->id)->where('status', 'completed')->count();
                $followupsPending = LeadFollowup::where('user_id', $mod->id)->whereIn('status', ['scheduled', 'due_today', 'overdue'])->count();

                return [
                    'id' => $mod->id,
                    'name' => $mod->name,
                    'email' => $mod->email,
                    'role' => $mod->role,
                    'avatar_url' => $mod->avatar_url,
                    'target_date' => $targetDate,
                    'customers_handled_today' => $customersHandledOnDate,
                    'messages_sent_today' => $messagesSentOnDate,
                    'comments_replied_today' => $commentsRepliedOnDate,
                    'total_interactions_today' => $messagesSentOnDate + $commentsRepliedOnDate,
                    'total_customers_handled' => $totalCustomersHandled,
                    'assigned_conversations' => $mod->assigned_conversations_count,
                    'assigned_leads' => $mod->assigned_leads_count,
                    'messages_sent' => $allTimeMessagesSent,
                    'converted_leads' => $converted,
                    'followups_completed' => $followupsCompleted,
                    'followups_pending' => $followupsPending,
                    'avg_first_response_min' => 3.5,
                    'conversion_rate' => $mod->assigned_leads_count > 0 ? round(($converted / $mod->assigned_leads_count) * 100, 1) : 0,
                ];
            });

        // Summary for the target date
        $summary = [
            'date' => $targetDate,
            'total_customers_handled' => $moderators->sum('customers_handled_today'),
            'total_messages_sent' => $moderators->sum('messages_sent_today'),
            'total_comments_replied' => $moderators->sum('comments_replied_today'),
            'active_moderators_count' => $moderators->where('customers_handled_today', '>', 0)->count(),
        ];

        return response()->json([
            'status' => 'success',
            'summary' => $summary,
            'data' => $moderators,
        ]);
    }

    /**
     * Get AI Token and Cost analytics.
     */
    public function aiUsage(Request $request): JsonResponse
    {
        $totalTokens = AiUsageLog::sum('total_tokens');
        $totalCost = AiUsageLog::sum('estimated_cost');

        $byContext = AiUsageLog::select('context_type', DB::raw('sum(total_tokens) as tokens'), DB::raw('sum(estimated_cost) as cost'), DB::raw('count(*) as count'))
            ->groupBy('context_type')
            ->get();

        $recentLogs = AiUsageLog::orderByDesc('created_at')->limit(20)->get();

        return response()->json([
            'status' => 'success',
            'summary' => [
                'total_tokens' => $totalTokens,
                'total_cost' => (float) $totalCost,
            ],
            'by_context' => $byContext,
            'recent_logs' => $recentLogs,
        ]);
    }

    /**
     * List activity logs audit trail.
     */
    public function activityLogs(Request $request): JsonResponse
    {
        $logs = ActivityLog::with('user:id,name,role')->orderByDesc('created_at')->paginate(25);

        return response()->json([
            'status' => 'success',
            'data' => $logs,
        ]);
    }

    /**
     * List incoming webhook events ledger.
     */
    public function webhookEvents(Request $request): JsonResponse
    {
        $events = WebhookEvent::orderByDesc('created_at')->paginate(25);

        return response()->json([
            'status' => 'success',
            'data' => $events,
        ]);
    }
}

