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
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $startDate = Carbon::parse($request->start_date)->startOfDay();
            $endDate = Carbon::parse($request->end_date)->endOfDay();
        } elseif ($request->filled('start_date')) {
            $startDate = Carbon::parse($request->start_date)->startOfDay();
            $endDate = Carbon::parse($request->start_date)->endOfDay();
        } elseif ($request->filled('date')) {
            $startDate = Carbon::parse($request->date)->startOfDay();
            $endDate = Carbon::parse($request->date)->endOfDay();
        } else {
            $startDate = today()->startOfDay();
            $endDate = today()->endOfDay();
        }

        if ($startDate->gt($endDate)) {
            $temp = $startDate;
            $startDate = $endDate->copy()->startOfDay();
            $endDate = $temp->copy()->endOfDay();
        }

        // 1. Calculate Read vs Unread Messages in this date range
        $customerMessagesInRange = Message::where('sender_type', 'customer')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->get(['id', 'conversation_id', 'delivery_status', 'created_at']);

        $totalCustomerMessages = $customerMessagesInRange->count();
        $conversationIds = $customerMessagesInRange->pluck('conversation_id')->unique();
        $conversationsMap = Conversation::whereIn('id', $conversationIds)->get()->keyBy('id');

        $readCount = 0;
        $unreadCount = 0;

        foreach ($customerMessagesInRange as $cMsg) {
            $conv = $conversationsMap->get($cMsg->conversation_id);
            if ($cMsg->delivery_status === 'read' || ($conv && $conv->unread_count === 0)) {
                $readCount++;
            } else {
                $unreadCount++;
            }
        }

        $readRate = $totalCustomerMessages > 0 ? round(($readCount / $totalCustomerMessages) * 100, 1) : 100;
        $activeUnreadConversationsCount = Conversation::whereIn('id', $conversationIds)
            ->where('unread_count', '>', 0)
            ->count();

        // 2. Calculate Average Response Times in this date range
        $allMessagesForTiming = Message::whereIn('conversation_id', $conversationIds)
            ->orderBy('conversation_id')
            ->orderBy('created_at', 'asc')
            ->get(['id', 'conversation_id', 'sender_type', 'sender_user_id', 'created_at']);

        $allResponseTimes = [];
        $moderatorResponseTimes = [];
        $messagesByConv = $allMessagesForTiming->groupBy('conversation_id');

        foreach ($messagesByConv as $convId => $convMsgs) {
            $pendingCustomerTime = null;

            foreach ($convMsgs as $m) {
                $mCreated = Carbon::parse($m->created_at);
                if ($m->sender_type === 'customer') {
                    if ($pendingCustomerTime === null) {
                        $pendingCustomerTime = $mCreated;
                    }
                } elseif (in_array($m->sender_type, ['moderator', 'ai', 'system'])) {
                    if ($pendingCustomerTime !== null) {
                        $inRange = ($pendingCustomerTime >= $startDate && $pendingCustomerTime <= $endDate)
                            || ($mCreated >= $startDate && $mCreated <= $endDate);

                        if ($inRange) {
                            $diffSec = abs($mCreated->diffInSeconds($pendingCustomerTime));
                            // Accept response times up to 7 days
                            if ($diffSec >= 0 && $diffSec <= 604800) {
                                $allResponseTimes[] = $diffSec;
                                if ($m->sender_user_id) {
                                    $moderatorResponseTimes[$m->sender_user_id][] = $diffSec;
                                }
                            }
                        }
                        $pendingCustomerTime = null;
                    }
                }
            }
        }

        $avgTeamResponseSec = count($allResponseTimes) > 0 ? (int) round(array_sum($allResponseTimes) / count($allResponseTimes)) : null;

        $formatSecondsToHuman = function (?int $seconds): string {
            if ($seconds === null) return 'No replies yet';
            if ($seconds < 60) return "{$seconds}s";
            $mins = floor($seconds / 60);
            $remSecs = $seconds % 60;
            if ($mins < 60) {
                return $remSecs > 0 ? "{$mins}m {$remSecs}s" : "{$mins}m";
            }
            $hours = floor($mins / 60);
            $remMins = $mins % 60;
            return $remMins > 0 ? "{$hours}h {$remMins}m" : "{$hours}h";
        };

        // 3. Moderator metrics
        $moderators = User::whereIn('role', ['moderator', 'admin', 'super_admin'])
            ->withCount(['assignedConversations', 'assignedLeads'])
            ->get()
            ->map(function ($mod) use ($startDate, $endDate, $moderatorResponseTimes, $formatSecondsToHuman) {
                // Messages sent in the date range
                $messagesSentInRange = Message::where('sender_user_id', $mod->id)
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->count();

                // Unique conversations/customers replied to in the date range
                $customersHandledInRange = Message::where('sender_user_id', $mod->id)
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->distinct('conversation_id')
                    ->count('conversation_id');

                // Facebook comments replied in the date range
                $commentsRepliedInRange = CommentReply::where('user_id', $mod->id)
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->count();

                // Converted leads in date range
                $convertedInRange = Lead::where('assigned_to_user_id', $mod->id)
                    ->where('status', 'converted')
                    ->where(function ($q) use ($startDate, $endDate) {
                        $q->whereBetween('last_status_change_at', [$startDate, $endDate])
                            ->orWhere(function ($sub) use ($startDate, $endDate) {
                                $sub->whereNull('last_status_change_at')
                                    ->whereBetween('updated_at', [$startDate, $endDate]);
                            });
                    })
                    ->count();

                // Total unique customers handled all-time
                $totalCustomersHandled = Message::where('sender_user_id', $mod->id)
                    ->distinct('conversation_id')
                    ->count('conversation_id');

                $allTimeMessagesSent = Message::where('sender_user_id', $mod->id)->count();
                $allTimeConverted = Lead::where('assigned_to_user_id', $mod->id)->where('status', 'converted')->count();
                $followupsCompleted = LeadFollowup::where('user_id', $mod->id)->where('status', 'completed')->count();
                $followupsPending = LeadFollowup::where('user_id', $mod->id)->whereIn('status', ['scheduled', 'due_today', 'overdue'])->count();

                $modTimes = $moderatorResponseTimes[$mod->id] ?? [];
                $modAvgSec = count($modTimes) > 0 ? (int) round(array_sum($modTimes) / count($modTimes)) : null;

                return [
                    'id' => $mod->id,
                    'name' => $mod->name,
                    'email' => $mod->email,
                    'role' => $mod->role,
                    'avatar_url' => $mod->avatar_url,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'customers_handled' => $customersHandledInRange,
                    'customers_handled_today' => $customersHandledInRange, // backward compatibility
                    'messages_sent' => $allTimeMessagesSent,
                    'messages_sent_range' => $messagesSentInRange,
                    'messages_sent_today' => $messagesSentInRange, // backward compatibility
                    'comments_replied_range' => $commentsRepliedInRange,
                    'comments_replied_today' => $commentsRepliedInRange, // backward compatibility
                    'total_interactions_range' => $messagesSentInRange + $commentsRepliedInRange,
                    'total_customers_handled' => $totalCustomersHandled,
                    'assigned_conversations' => $mod->assigned_conversations_count,
                    'assigned_leads' => $mod->assigned_leads_count,
                    'converted_leads' => $allTimeConverted,
                    'converted_leads_range' => $convertedInRange,
                    'followups_completed' => $followupsCompleted,
                    'followups_pending' => $followupsPending,
                    'avg_first_response_min' => $modAvgSec !== null ? round($modAvgSec / 60, 1) : null,
                    'avg_response_time_seconds' => $modAvgSec,
                    'avg_response_time_formatted' => $formatSecondsToHuman($modAvgSec),
                    'total_replies_timed' => count($modTimes),
                    'conversion_rate' => $mod->assigned_leads_count > 0 ? round(($allTimeConverted / $mod->assigned_leads_count) * 100, 1) : 0,
                ];
            });

        // Summary for the target date range
        $summary = [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'is_single_day' => $startDate->toDateString() === $endDate->toDateString(),
            'total_customers_handled' => $moderators->sum('customers_handled'),
            'total_messages_sent' => $moderators->sum('messages_sent_range'),
            'total_comments_replied' => $moderators->sum('comments_replied_range'),
            'active_moderators_count' => $moderators->where('customers_handled', '>', 0)->count(),

            // Read / Unread message metrics for selected date
            'total_customer_messages' => $totalCustomerMessages,
            'read_messages_count' => $readCount,
            'unread_messages_count' => $unreadCount,
            'read_rate_percentage' => $readRate,
            'unread_conversations_count' => $activeUnreadConversationsCount,
            'active_conversations_count' => count($conversationIds),

            // Average Response Time metrics
            'avg_response_time_seconds' => $avgTeamResponseSec,
            'avg_response_time_formatted' => $formatSecondsToHuman($avgTeamResponseSec),
            'total_replies_timed' => count($allResponseTimes),
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

