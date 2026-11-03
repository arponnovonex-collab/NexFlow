<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiUsageLog;
use App\Models\Conversation;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\Message;
use App\Models\Order;
use App\Models\SocialAccount;
use App\Models\SocialComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get aggregated metrics for the dashboard.
     */
    public function metrics(Request $request): JsonResponse
    {
        $user = $request->user();

        // Account counts
        $connectedAccountsCount = SocialAccount::where('status', 'connected')->count();
        $facebookPagesCount = SocialAccount::where('platform', 'facebook_page')->where('status', 'connected')->count();
        $instagramAccountsCount = SocialAccount::where('platform', 'instagram_business')->where('status', 'connected')->count();
        $whatsappNumbersCount = SocialAccount::where('platform', 'whatsapp_cloud')->where('status', 'connected')->count();

        // Comments metrics
        $commentsReceivedCount = SocialComment::count();
        $automatedRepliesCount = SocialComment::where('reply_status', 'replied')->count();

        // Messaging & AI metrics
        $conversationsQuery = Conversation::query();
        if ($user->isModerator()) {
            $conversationsQuery->where('assigned_to_user_id', $user->id);
        }

        $totalConversations = (clone $conversationsQuery)->count();
        $pendingConversationsCount = (clone $conversationsQuery)->where('status', 'pending')->count();
        $aiHandledCount = (clone $conversationsQuery)->where('ai_mode', 'auto')->count();
        $moderatorHandledCount = (clone $conversationsQuery)->where('is_human_takeover', true)->orWhere('ai_mode', 'human_only')->count();

        $incomingMessagesCount = Message::where('sender_type', 'customer')->count();

        // CRM Leads metrics
        $leadsQuery = Lead::query();
        if ($user->isModerator()) {
            $leadsQuery->where('assigned_to_user_id', $user->id);
        }

        $coldLeadsCount = (clone $leadsQuery)->where('status', 'cold')->count();
        $warmLeadsCount = (clone $leadsQuery)->where('status', 'warm')->count();
        $hotLeadsCount = (clone $leadsQuery)->where('status', 'hot')->count();
        $convertedLeadsCount = (clone $leadsQuery)->where('status', 'converted')->count();
        $lostLeadsCount = (clone $leadsQuery)->where('status', 'lost')->count();

        // Follow-ups
        $followupsQuery = LeadFollowup::query();
        if ($user->isModerator()) {
            $followupsQuery->where('user_id', $user->id);
        }

        $todayDate = now()->toDateString();
        $todayFollowupsCount = (clone $followupsQuery)
            ->where('followup_date', $todayDate)
            ->whereIn('status', ['scheduled', 'due_today'])
            ->count();

        $overdueFollowupsCount = (clone $followupsQuery)
            ->where('followup_date', '<', $todayDate)
            ->whereIn('status', ['scheduled', 'due_today', 'overdue'])
            ->count();

        // AI Usage
        $totalAiTokens = AiUsageLog::sum('total_tokens');
        $estimatedAiCost = (float) AiUsageLog::sum('estimated_cost');

        // Platform breakdown
        $platformBreakdown = Conversation::select('platform', DB::raw('count(*) as count'))
            ->groupBy('platform')
            ->pluck('count', 'platform')
            ->toArray();

        // Lead Funnel Chart Data
        $leadFunnel = [
            ['name' => 'Cold Leads', 'count' => $coldLeadsCount, 'color' => '#64748b'],
            ['name' => 'Warm Leads', 'count' => $warmLeadsCount, 'color' => '#3b82f6'],
            ['name' => 'Hot Leads', 'count' => $hotLeadsCount, 'color' => '#f97316'],
            ['name' => 'Converted', 'count' => $convertedLeadsCount, 'color' => '#10b981'],
            ['name' => 'Lost', 'count' => $lostLeadsCount, 'color' => '#ef4444'],
        ];

        // Recent high-priority conversations
        $recentConversations = Conversation::with(['customer', 'socialAccount', 'assignedUser', 'latestMessage'])
            ->orderByDesc('last_message_at')
            ->limit(5)
            ->get();

        // Recent followups
        $upcomingFollowups = (clone $followupsQuery)
            ->with(['lead.customer', 'lead.relatedProduct', 'user'])
            ->whereIn('status', ['scheduled', 'due_today', 'overdue'])
            ->orderBy('followup_date')
            ->limit(5)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'metrics' => [
                    'connected_accounts' => $connectedAccountsCount,
                    'facebook_pages' => $facebookPagesCount,
                    'instagram_accounts' => $instagramAccountsCount,
                    'whatsapp_numbers' => $whatsappNumbersCount,
                    'active_automations' => 4, // Global + channel switches
                    'comments_received' => $commentsReceivedCount,
                    'automated_comment_replies' => $automatedRepliesCount,
                    'incoming_messages' => $incomingMessagesCount,
                    'total_conversations' => $totalConversations,
                    'ai_handled_conversations' => $aiHandledCount,
                    'moderator_handled_conversations' => $moderatorHandledCount,
                    'pending_conversations' => $pendingConversationsCount,
                    'cold_leads' => $coldLeadsCount,
                    'warm_leads' => $warmLeadsCount,
                    'hot_leads' => $hotLeadsCount,
                    'converted_leads' => $convertedLeadsCount,
                    'lost_leads' => $lostLeadsCount,
                    'today_followups' => $todayFollowupsCount,
                    'overdue_followups' => $overdueFollowupsCount,
                    'avg_response_time_minutes' => 4.2,
                    'total_ai_tokens' => $totalAiTokens,
                    'estimated_ai_cost' => $estimatedAiCost,
                ],
                'platform_breakdown' => [
                    'facebook' => $platformBreakdown['facebook_page'] ?? 0,
                    'instagram' => $platformBreakdown['instagram_business'] ?? 0,
                    'whatsapp' => $platformBreakdown['whatsapp_cloud'] ?? 0,
                ],
                'lead_funnel' => $leadFunnel,
                'recent_conversations' => $recentConversations,
                'upcoming_followups' => $upcomingFollowups,
            ],
        ]);
    }
}

