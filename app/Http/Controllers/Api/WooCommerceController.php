<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WooCommerceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class WooCommerceController extends Controller
{
    public function __construct(protected WooCommerceService $wcService)
    {
    }

    /**
     * Get current WooCommerce settings.
     */
    public function getSettings(): JsonResponse
    {
        $settings = $this->wcService->getSettings();

        return response()->json([
            'status' => 'success',
            'data' => [
                'store_url' => $settings->store_url,
                'consumer_key' => $settings->consumer_key ? (substr($settings->consumer_key, 0, 7) . '...' . substr($settings->consumer_key, -4)) : '',
                'consumer_secret' => $settings->consumer_secret ? '••••••••••••••••' : '',
                'has_keys' => ! empty($settings->consumer_key) && ! empty($settings->consumer_secret),
                'is_enabled' => (bool) $settings->is_enabled,
                'auto_sync_orders' => (bool) $settings->auto_sync_orders,
                'webhook_url' => url('/api/webhooks/woocommerce'),
                'webhook_secret' => $settings->webhook_secret,
                'last_synced_at' => $settings->last_synced_at ? $settings->last_synced_at->toIso8601String() : null,
                'sync_status' => $settings->sync_status,
                'last_error' => $settings->last_error,
            ],
        ]);
    }

    /**
     * Save WooCommerce settings and optionally test connection.
     */
    public function saveSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store_url' => 'required|string|max:255',
            'consumer_key' => 'nullable|string|max:255',
            'consumer_secret' => 'nullable|string|max:255',
            'is_enabled' => 'required|boolean',
            'auto_sync_orders' => 'nullable|boolean',
        ]);

        $settings = $this->wcService->getSettings();

        $updateData = [
            'store_url' => $validated['store_url'],
            'is_enabled' => $validated['is_enabled'],
            'auto_sync_orders' => $validated['auto_sync_orders'] ?? true,
        ];

        // Only update keys if provided and not masked
        if (! empty($validated['consumer_key']) && ! str_contains($validated['consumer_key'], '...')) {
            $updateData['consumer_key'] = $validated['consumer_key'];
        }
        if (! empty($validated['consumer_secret']) && ! str_contains($validated['consumer_secret'], '•••')) {
            $updateData['consumer_secret'] = $validated['consumer_secret'];
        }

        if (empty($settings->webhook_secret)) {
            $updateData['webhook_secret'] = bin2hex(random_bytes(16));
        }

        $settings->update($updateData);

        // Test connection if enabled and keys exist
        $testResult = null;
        if ($settings->is_enabled && ! empty($settings->consumer_key) && ! empty($settings->consumer_secret)) {
            $testResult = $this->wcService->testConnection(
                $settings->store_url,
                $settings->consumer_key,
                $settings->consumer_secret
            );
            if (! $testResult['success']) {
                $settings->update([
                    'sync_status' => 'failed',
                    'last_error' => $testResult['message'],
                ]);
            } else {
                $settings->update([
                    'sync_status' => 'idle',
                    'last_error' => null,
                ]);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'WooCommerce settings saved successfully.',
            'test_result' => $testResult,
        ]);
    }

    /**
     * Manual Trigger Sync Orders.
     */
    public function syncNow(): JsonResponse
    {
        $result = $this->wcService->syncOrders();

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
            'synced_count' => $result['synced_count'] ?? 0,
        ], $result['success'] ? 200 : 422);
    }

    /**
     * Handle incoming WooCommerce order webhook (order.created or order.updated).
     */
    public function handleWebhook(Request $request): Response
    {
        $payload = $request->all();
        $topic = $request->header('X-WC-Webhook-Topic', 'order.created');

        Log::info("WooCommerce Webhook [{$topic}] received", ['id' => $payload['id'] ?? null]);

        if (! empty($payload['id']) && is_array($payload)) {
            try {
                $this->wcService->processWooCommerceOrder($payload);
            } catch (\Throwable $e) {
                Log::error('Error processing WC Webhook order: ' . $e->getMessage());
            }
        }

        return response('OK', 200);
    }
}
