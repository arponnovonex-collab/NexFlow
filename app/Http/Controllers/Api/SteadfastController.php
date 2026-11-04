<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\SteadfastCourierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SteadfastController extends Controller
{
    public function __construct(protected SteadfastCourierService $steadfastService)
    {
    }

    /**
     * Get Steadfast configuration & balance.
     */
    public function getSettings(): JsonResponse
    {
        $settings = $this->steadfastService->getSettings();

        return response()->json([
            'status' => 'success',
            'data' => [
                'provider' => $settings->provider,
                'api_key' => $settings->api_key,
                'secret_key' => $settings->secret_key,
                'is_enabled' => (bool) $settings->is_enabled,
                'contact_name' => $settings->contact_name ?: 'Auliro',
                'contact_phone' => $settings->contact_phone ?: '01333-447475',
                'delivery_type' => $settings->delivery_type ?: 'home',
                'last_balance' => $settings->last_balance,
            ],
        ]);
    }

    /**
     * Save Steadfast configuration.
     */
    public function saveSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => 'nullable|string|max:255',
            'secret_key' => 'nullable|string|max:255',
            'is_enabled' => 'required|boolean',
            'contact_name' => 'nullable|string|max:100',
            'contact_phone' => 'nullable|string|max:50',
            'delivery_type' => 'nullable|string|max:50',
        ]);

        $settings = $this->steadfastService->getSettings();
        $settings->update($validated);

        $balanceResult = null;
        if (! empty($settings->api_key) && ! empty($settings->secret_key)) {
            $balanceResult = $this->steadfastService->checkBalance();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Steadfast Courier configuration saved successfully!',
            'data' => $settings->fresh(),
            'balance_check' => $balanceResult,
        ]);
    }

    /**
     * Check live balance from Steadfast.
     */
    public function checkBalance(): JsonResponse
    {
        $result = $this->steadfastService->checkBalance();

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
            'balance' => $result['balance'] ?? 0.00,
        ]);
    }

    /**
     * Send a single order to Steadfast.
     */
    public function sendOrder(Order $order): JsonResponse
    {
        $order->load(['customer', 'product', 'variant']);
        $result = $this->steadfastService->sendOrder($order);

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => $result['message'],
                'data' => $order->fresh(['customer', 'product', 'variant']),
                'tracking_code' => $result['tracking_code'],
            ]);
        }

        return response()->json([
            'status' => 'error',
            'message' => $result['message'],
        ], 422);
    }

    /**
     * Send bulk orders to Steadfast.
     */
    public function sendBulk(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
        ]);

        $result = $this->steadfastService->sendBulkOrders($validated['order_ids']);

        return response()->json([
            'status' => 'success',
            'message' => "Steadfast Batch: {$result['success_count']} orders placed successfully, {$result['failed_count']} failed.",
            'data' => $result,
        ]);
    }
}
