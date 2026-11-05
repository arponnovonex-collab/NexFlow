<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\SmsSetting;
use App\Models\SocialAccount;
use App\Services\BulkSmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get system notifications for current user with live health triggers.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Live Check: BulkSMS BD balance check (< 50 BDT alert)
        $smsSettings = SmsSetting::where('provider', 'bulksmsbd')->first();
        if ($smsSettings && ! empty($smsSettings->api_key)) {
            // Refresh balance if null or older than 5 minutes
            if (! $smsSettings->last_balance_checked_at || $smsSettings->last_balance_checked_at->lt(now()->subMinutes(5))) {
                try {
                    app(BulkSmsService::class)->checkBalance();
                    $smsSettings->refresh();
                } catch (\Throwable $e) {
                    // Ignore transient network errors
                }
            }

            $currentBalance = (float) ($smsSettings->last_balance ?? 0.0);
            if ($currentBalance < 50.00) {
                // Ensure low balance alert notification exists
                Notification::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'link' => '/sms/gateway',
                        'type' => 'urgent',
                    ],
                    [
                        'title' => 'BulkSMS BD ব্যালেন্স কম (Low Balance)',
                        'message' => 'আপনার BulkSMS BD একাউন্টে ব্যালেন্স মাত্র ৳' . number_format($currentBalance, 2) . ' আছে (৫০ টাকার কম)। অর্ডার কনফার্মেশন ও মার্কেটিং SMS সচল রাখতে দ্রুত রিচার্জ করুন।',
                        'is_read' => false,
                    ]
                );
            } else {
                // Clean up low-balance notification if user recharged
                Notification::where('user_id', $user->id)
                    ->where('link', '/sms/gateway')
                    ->where('type', 'urgent')
                    ->delete();
            }
        }

        // 2. Live Check: Expired Meta/WhatsApp tokens
        $expiredAccounts = SocialAccount::where('status', 'expired')->get();
        foreach ($expiredAccounts as $acc) {
            Notification::firstOrCreate(
                [
                    'user_id' => $user->id,
                    'link' => '/connections',
                    'title' => "টোকেন এক্সপায়ার হয়েছে ({$acc->name})",
                ],
                [
                    'message' => "{$acc->name} চ্যানেলের Meta অ্যাক্সেস টোকেনের মেয়াদ শেষ হয়ে গেছে। মেসেজিং চালু রাখতে রিকানেক্ট করুন।",
                    'type' => 'urgent',
                    'is_read' => false,
                ]
            );
        }

        // 3. Fetch notifications for user
        $notifications = Notification::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(25)
            ->get()
            ->map(function ($n) {
                return [
                    'id' => $n->id,
                    'title' => $n->title,
                    'message' => $n->message,
                    'type' => $n->type, // urgent, warning, info, success
                    'is_read' => (bool) $n->is_read,
                    'link' => $n->link,
                    'created_at' => $n->created_at?->toIso8601String(),
                    'time_ago' => $n->created_at?->diffForHumans() ?? 'Just now',
                ];
            });

        $unreadCount = Notification::where('user_id', $user->id)->where('is_read', false)->count();

        return response()->json([
            'status' => 'success',
            'unread_count' => $unreadCount,
            'data' => $notifications,
            'bulk_sms_balance' => $smsSettings ? (float) $smsSettings->last_balance : null,
        ]);
    }

    /**
     * Mark single notification as read.
     */
    public function markAsRead(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id === $request->user()->id) {
            $notification->update(['is_read' => true]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Notification marked as read.',
        ]);
    }

    /**
     * Mark all notifications for current user as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'status' => 'success',
            'message' => 'All notifications marked as read.',
        ]);
    }

    /**
     * Delete notification.
     */
    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id === $request->user()->id) {
            $notification->delete();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Notification deleted.',
        ]);
    }
}
