<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\SmsCampaign;
use App\Models\SmsLog;
use App\Services\BulkSmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmsController extends Controller
{
    public function __construct(protected BulkSmsService $smsService)
    {
    }

    /**
     * Get SMS Gateway configuration & balance.
     */
    public function getGatewayConfig(): JsonResponse
    {
        $settings = $this->smsService->getSettings();

        return response()->json([
            'status' => 'success',
            'data' => [
                'provider' => $settings->provider,
                'api_key' => $settings->api_key,
                'sender_id' => $settings->sender_id,
                'is_enabled' => (bool) $settings->is_enabled,
                'last_balance' => $settings->last_balance,
                'last_balance_checked_at' => $settings->last_balance_checked_at,
            ],
        ]);
    }

    /**
     * Save Gateway configuration.
     */
    public function saveGatewayConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => 'nullable|string|max:255',
            'sender_id' => 'nullable|string|max:50',
            'is_enabled' => 'required|boolean',
        ]);

        $settings = $this->smsService->getSettings();
        $settings->update($validated);

        // Auto verify balance if api_key provided
        $balanceResult = null;
        if (! empty($settings->api_key)) {
            $balanceResult = $this->smsService->checkBalance();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'BulkSMS BD Gateway configuration updated successfully!',
            'data' => $settings->fresh(),
            'balance_check' => $balanceResult,
        ]);
    }

    /**
     * Check live balance from BulkSMS BD.
     */
    public function checkBalance(): JsonResponse
    {
        $result = $this->smsService->checkBalance();

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
            'balance' => $result['balance'] ?? 0.00,
        ]);
    }

    /**
     * Send test SMS.
     */
    public function sendTestSms(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string',
            'message' => 'required|string|max:500',
        ]);

        $result = $this->smsService->sendSms(
            number: $validated['phone'],
            message: $validated['message'],
            type: 'test'
        );

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => 'Test SMS delivered successfully!',
                'data' => $result,
            ]);
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Failed to send test SMS: ' . $result['message'],
            'data' => $result,
        ], 422);
    }

    /**
     * Get Auto-SMS configuration & recent logs.
     */
    public function getAutoSmsConfig(): JsonResponse
    {
        $settings = $this->smsService->getSettings();
        $recentLogs = SmsLog::with(['order:id,order_number,total_amount', 'customer:id,name'])
            ->where('type', 'auto_order')
            ->latest()
            ->limit(15)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'auto_sms_enabled' => (bool) $settings->auto_sms_enabled,
                'auto_sms_template' => $settings->auto_sms_template,
                'gateway_enabled' => (bool) $settings->is_enabled,
                'has_api_key' => ! empty($settings->api_key),
                'recent_logs' => $recentLogs,
            ],
        ]);
    }

    /**
     * Save Auto-SMS template and toggle.
     */
    public function saveAutoSmsConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'auto_sms_enabled' => 'required|boolean',
            'auto_sms_template' => 'required|string|max:1000',
        ]);

        $settings = $this->smsService->getSettings();
        $settings->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Auto-SMS settings saved successfully!',
            'data' => $settings->fresh(),
        ]);
    }

    /**
     * Get target recipient count for SMS Marketing.
     */
    public function getMarketingRecipients(Request $request): JsonResponse
    {
        $targetType = $request->query('target_type', 'all_customers');
        $productId = $request->query('product_id');

        $query = Customer::whereNotNull('phone')->where('phone', '!=', '');

        if ($targetType === 'product_buyers' && ! empty($productId)) {
            $query->whereHas('orders', function ($q) use ($productId) {
                $q->where('product_id', $productId);
            });
        }

        $count = $query->count();
        $sample = $query->limit(5)->get(['id', 'name', 'phone']);

        return response()->json([
            'status' => 'success',
            'recipient_count' => $count,
            'sample' => $sample,
        ]);
    }

    /**
     * Send SMS Marketing Campaign.
     */
    public function sendMarketingCampaign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string|max:1000',
            'target_type' => 'required|in:all_customers,product_buyers',
            'target_product_id' => 'nullable|exists:products,id',
        ]);

        $user = $request->user();
        $query = Customer::whereNotNull('phone')->where('phone', '!=', '');

        $productName = '';
        if ($validated['target_type'] === 'product_buyers' && ! empty($validated['target_product_id'])) {
            $product = Product::find($validated['target_product_id']);
            $productName = $product?->name ?? '';
            $query->whereHas('orders', function ($q) use ($validated) {
                $q->where('product_id', $validated['target_product_id']);
            });
        }

        $customers = $query->get(['id', 'name', 'phone']);

        if ($customers->isEmpty()) {
            return response()->json([
                'status' => 'error',
                'message' => 'No customers found with valid phone numbers for the selected audience.',
            ], 422);
        }

        $campaign = SmsCampaign::create([
            'title' => $validated['title'],
            'message' => $validated['message'],
            'target_type' => $validated['target_type'],
            'target_product_id' => $validated['target_product_id'] ?? null,
            'recipient_count' => $customers->count(),
            'sent_count' => 0,
            'failed_count' => 0,
            'status' => 'sending',
            'user_id' => $user->id,
        ]);

        $sent = 0;
        $failed = 0;

        foreach ($customers as $customer) {
            $personalized = str_replace(
                ['{customer_name}', '{phone}', '{product_name}'],
                [$customer->name, $customer->phone, $productName],
                $validated['message']
            );

            $res = $this->smsService->sendSms(
                number: $customer->phone,
                message: $personalized,
                type: 'marketing',
                customerId: $customer->id,
                campaignId: $campaign->id
            );

            if ($res['success']) {
                $sent++;
            } else {
                $failed++;
            }
        }

        $campaign->update([
            'sent_count' => $sent,
            'failed_count' => $failed,
            'status' => 'completed',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Campaign '{$campaign->title}' finished: {$sent} sent, {$failed} failed.",
            'campaign' => $campaign->load('targetProduct:id,name'),
        ]);
    }

    /**
     * List SMS campaigns.
     */
    public function getCampaigns(Request $request): JsonResponse
    {
        $campaigns = SmsCampaign::with(['targetProduct:id,name', 'user:id,name'])
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json([
            'status' => 'success',
            'data' => $campaigns,
        ]);
    }

    /**
     * List SMS logs.
     */
    public function getLogs(Request $request): JsonResponse
    {
        $query = SmsLog::with(['order:id,order_number', 'customer:id,name']);

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('phone_number', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%"));
            });
        }

        $logs = $query->latest()->paginate($request->integer('per_page', 25));

        return response()->json([
            'status' => 'success',
            'data' => $logs,
        ]);
    }
}
