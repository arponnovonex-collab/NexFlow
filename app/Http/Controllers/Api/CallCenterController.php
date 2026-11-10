<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CallLog;
use App\Models\Customer;
use App\Services\EpbxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CallCenterController extends Controller
{
    public function __construct(protected EpbxService $epbxService)
    {
    }

    /**
     * Get current ePBX.bd configuration and account balance.
     */
    public function getSettings(): JsonResponse
    {
        $settings = $this->epbxService->getSettings();
        $webhookUrl = url('/api/webhooks/epbx');

        return response()->json([
            'status' => 'success',
            'data' => [
                'provider' => $settings->provider,
                'api_base_url' => $settings->api_base_url ?: 'https://epbx.bd/api/v1',
                'api_token' => $settings->api_token,
                'trunk_number' => $settings->trunk_number,
                'default_extension' => $settings->default_extension ?: '101',
                'webhook_secret' => $settings->webhook_secret,
                'webhook_url' => $webhookUrl,
                'is_enabled' => (bool) $settings->is_enabled,
                'last_balance' => $settings->last_balance,
                'last_checked_at' => $settings->last_checked_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Save ePBX.bd configuration.
     */
    public function saveSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_base_url' => 'nullable|string|max:255',
            'api_token' => 'nullable|string',
            'trunk_number' => 'nullable|string|max:50',
            'default_extension' => 'nullable|string|max:20',
            'is_enabled' => 'required|boolean',
        ]);

        $settings = $this->epbxService->getSettings();
        $settings->update([
            'api_base_url' => $validated['api_base_url'] ?: 'https://epbx.bd/api/v1',
            'api_token' => $validated['api_token'] !== null ? trim($validated['api_token']) : $settings->api_token,
            'trunk_number' => $validated['trunk_number'],
            'default_extension' => $validated['default_extension'] ?: '101',
            'is_enabled' => $validated['is_enabled'],
        ]);

        // Auto test connection if token is provided
        $testResult = null;
        if (! empty($settings->api_token)) {
            $testResult = $this->epbxService->testConnection($settings);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'ePBX.bd settings saved successfully!',
            'test_result' => $testResult,
            'data' => $settings->fresh(),
        ]);
    }

    /**
     * Manually trigger connection test & balance sync.
     */
    public function testConnection(): JsonResponse
    {
        $result = $this->epbxService->testConnection();

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
            'balance' => $result['balance'] ?? null,
        ], $result['success'] ? 200 : 422);
    }

    /**
     * Trigger a Click-to-Call (Originate) request.
     */
    public function originateCall(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string|min:7|max:25',
            'extension' => 'nullable|string|max:20',
        ]);

        $user = $request->user();
        $result = $this->epbxService->originateCall(
            $validated['phone'],
            $validated['extension'] ?? null,
            $user?->id
        );

        if (! $result['success']) {
            return response()->json([
                'status' => 'error',
                'message' => $result['message'],
                'call_log' => $result['call_log'] ?? null,
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => $result['message'],
            'call_log' => $result['call_log'],
        ]);
    }

    /**
     * Fetch paginated Call Detail Records (CDR).
     */
    public function getCallLogs(Request $request): JsonResponse
    {
        $query = CallLog::with(['customer', 'agent'])
            ->latest('id');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('customer_phone', 'like', "%{$term}%")
                    ->orWhere('agent_extension', 'like', "%{$term}%")
                    ->orWhereHas('customer', function ($cq) use ($term) {
                        $cq->where('name', 'like', "%{$term}%");
                    });
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('direction') && $request->direction !== 'all') {
            $query->where('direction', $request->direction);
        }

        $logs = $query->paginate($request->input('per_page', 20));

        return response()->json([
            'status' => 'success',
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * Update call disposition and agent notes.
     */
    public function updateCallLog(Request $request, CallLog $callLog): JsonResponse
    {
        $validated = $request->validate([
            'disposition' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:1000',
        ]);

        $callLog->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Call log updated.',
            'call_log' => $callLog->fresh(['customer', 'agent']),
        ]);
    }

    /**
     * Instant customer lookup by phone number for the dialer.
     */
    public function lookupCustomer(Request $request): JsonResponse
    {
        $phone = $request->input('phone', '');
        $clean = $this->epbxService->formatPhoneNumber($phone);

        if (strlen($clean) < 5) {
            return response()->json(['status' => 'success', 'customer' => null]);
        }

        $customer = Customer::withCount('orders')
            ->where('phone', $clean)
            ->orWhere('phone', '+88' . $clean)
            ->orWhere('phone', '88' . $clean)
            ->first();

        return response()->json([
            'status' => 'success',
            'customer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
                'city' => $customer->city,
                'orders_count' => $customer->orders_count,
            ] : null,
        ]);
    }
}
