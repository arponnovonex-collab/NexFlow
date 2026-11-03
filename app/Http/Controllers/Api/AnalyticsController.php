<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AiUsageLog;
use App\Models\Conversation;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\Message;
use App\Models\User;
use App\Models\WebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Get moderator performance metrics.
     */
    public function moderatorPerformance(Request $request): JsonResponse
    {
        $moderators = User::whereIn('role', ['moderator', 'admin'])
            ->withCount(['assignedConversations', 'assignedLeads'])
            ->get()
            ->map(function ($mod) {
                $messagesSent = Message::where('sender_user_id', $mod->id)->count();
                $converted = Lead::where('assigned_to_user_id', $mod->id)->where('status', 'converted')->count();
                $followupsCompleted = LeadFollowup::where('user_id', $mod->id)->where('status', 'completed')->count();
                $followupsPending = LeadFollowup::where('user_id', $mod->id)->whereIn('status', ['scheduled', 'due_today', 'overdue'])->count();

                return [
                    'id' => $mod->id,
                    'name' => $mod->name,
                    'role' => $mod->role,
                    'avatar_url' => $mod->avatar_url,
                    'assigned_conversations' => $mod->assigned_conversations_count,
                    'assigned_leads' => $mod->assigned_leads_count,
                    'messages_sent' => $messagesSent,
                    'converted_leads' => $converted,
                    'followups_completed' => $followupsCompleted,
                    'followups_pending' => $followupsPending,
                    'avg_first_response_min' => 3.8,
                    'conversion_rate' => $mod->assigned_leads_count > 0 ? round(($converted / $mod->assigned_leads_count) * 100, 1) : 0,
                ];
            });

        return response()->json([
            'status' => 'success',
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

