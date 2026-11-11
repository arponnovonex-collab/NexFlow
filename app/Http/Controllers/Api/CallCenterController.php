<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CallLog;
use App\Models\Customer;
use App\Services\EpbxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

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
                'extension_password' => $settings->extension_password ?: 'MJt#27766',
                'sip_server' => $settings->sip_server ?: '103.15.140.151',
                'sip_port' => $settings->sip_port ?: '5060',
                'web_dialer_url' => $settings->web_dialer_url ?: 'https://auliro010.epbx.bd/dialer',
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
            'extension_password' => 'nullable|string|max:255',
            'sip_server' => 'nullable|string|max:100',
            'sip_port' => 'nullable|string|max:10',
            'web_dialer_url' => 'nullable|string|max:255',
            'is_enabled' => 'required|boolean',
        ]);

        $settings = $this->epbxService->getSettings();
        $settings->update([
            'api_base_url' => $validated['api_base_url'] ?: 'https://epbx.bd/api/v1',
            'api_token' => $validated['api_token'] !== null ? trim($validated['api_token']) : $settings->api_token,
            'trunk_number' => $validated['trunk_number'],
            'default_extension' => $validated['default_extension'] ?: '101',
            'extension_password' => $validated['extension_password'] ?? $settings->extension_password,
            'sip_server' => $validated['sip_server'] ?? $settings->sip_server,
            'sip_port' => $validated['sip_port'] ?? $settings->sip_port,
            'web_dialer_url' => $validated['web_dialer_url'] ?? $settings->web_dialer_url,
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
     * Store a call log from the direct browser WebRTC dialer.
     */
    public function storeCallLog(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'direction' => 'required|in:inbound,outbound',
            'customer_phone' => 'required|string|max:30',
            'status' => 'required|string|max:50',
            'duration_seconds' => 'nullable|integer',
            'disposition' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:1000',
            'call_session_id' => 'nullable|string|max:100',
        ]);

        $settings = $this->epbxService->getSettings();
        $user = $request->user();
        $formattedPhone = $this->epbxService->formatPhoneNumber($validated['customer_phone']);

        $customer = Customer::where('phone', $formattedPhone)
            ->orWhere('phone', '+88' . $formattedPhone)
            ->orWhere('phone', '88' . $formattedPhone)
            ->first();

        $log = CallLog::create([
            'call_session_id' => $validated['call_session_id'] ?? ('webrtc_' . uniqid() . '_' . time()),
            'direction' => $validated['direction'],
            'customer_phone' => $formattedPhone,
            'customer_id' => $customer?->id,
            'agent_user_id' => $user?->id,
            'agent_extension' => $settings->default_extension ?: '102',
            'trunk_number' => $settings->trunk_number,
            'status' => in_array($validated['status'], ['answered', 'completed', 'success']) ? 'answered' : ($validated['status'] === 'failed' ? 'failed' : 'no_answer'),
            'duration_seconds' => $validated['duration_seconds'] ?? 0,
            'disposition' => $validated['disposition'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'started_at' => now()->subSeconds($validated['duration_seconds'] ?? 0),
            'ended_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $log->fresh(['customer', 'agent']),
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

    /**
     * Pull and sync call history directly from ePBX.bd server.
     */
    public function syncLogs(): JsonResponse
    {
        $result = $this->epbxService->syncCallHistory();

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
        ], $result['success'] ? 200 : 422);
    }

    /**
     * Get paginated Call Recordings with filters and statistics.
     */
    public function getRecordings(Request $request): JsonResponse
    {
        $query = CallLog::with(['customer', 'agent'])
            ->where(function ($q) {
                $q->whereNotNull('recording_url')
                    ->orWhere('duration_seconds', '>', 0)
                    ->orWhere('status', 'answered');
            })
            ->latest('id');

        // Search by phone, customer name, or notes
        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('customer_phone', 'like', "%{$term}%")
                    ->orWhere('agent_extension', 'like', "%{$term}%")
                    ->orWhere('notes', 'like', "%{$term}%")
                    ->orWhereHas('customer', function ($cq) use ($term) {
                        $cq->where('name', 'like', "%{$term}%");
                    });
            });
        }

        // Filter by direction
        if ($request->filled('direction') && $request->direction !== 'all') {
            $query->where('direction', $request->direction);
        }

        // Filter by date range
        if ($request->filled('date_range')) {
            switch ($request->date_range) {
                case 'today':
                    $query->whereDate('started_at', now()->today());
                    break;
                case 'yesterday':
                    $query->whereDate('started_at', now()->subDay()->toDateString());
                    break;
                case 'last_7_days':
                    $query->where('started_at', '>=', now()->subDays(7));
                    break;
                case 'this_month':
                    $query->where('started_at', '>=', now()->startOfMonth());
                    break;
            }
        }

        // Duration filter
        if ($request->filled('min_duration') && (int) $request->min_duration > 0) {
            $query->where('duration_seconds', '>=', (int) $request->min_duration);
        }

        $recordings = $query->paginate($request->input('per_page', 15));

        // Format and ensure recording stream URLs
        $items = collect($recordings->items())->map(function ($log) {
            $callId = $log->call_session_id;
            if (! empty($log->recording_url) && preg_match('/recordings\/([a-zA-Z0-9_\.]+)/', $log->recording_url, $m)) {
                $callId = $m[1];
            }
            $streamUrl = ! empty($callId) && ! str_starts_with($callId, 'webrtc_')
                ? url("/api/call-center/recordings/{$callId}")
                : null;

            $data = $log->toArray();
            $data['stream_url'] = $streamUrl;
            return $data;
        });

        // Compute summary metrics
        $allQuery = CallLog::where(function ($q) {
            $q->whereNotNull('recording_url')
                ->orWhere('duration_seconds', '>', 0)
                ->orWhere('status', 'answered');
        });

        $totalCount = (clone $allQuery)->count();
        $totalSeconds = (clone $allQuery)->sum('duration_seconds');
        $todayCount = (clone $allQuery)->whereDate('started_at', now()->today())->count();
        $todaySeconds = (clone $allQuery)->whereDate('started_at', now()->today())->sum('duration_seconds');

        return response()->json([
            'status' => 'success',
            'data' => $items,
            'meta' => [
                'current_page' => $recordings->currentPage(),
                'last_page' => $recordings->lastPage(),
                'total' => $recordings->total(),
            ],
            'stats' => [
                'total_recordings' => $totalCount,
                'total_minutes' => round($totalSeconds / 60, 1),
                'today_recordings' => $todayCount,
                'today_minutes' => round($todaySeconds / 60, 1),
            ],
        ]);
    }

    /**
     * Stream audio recording from ePBX.bd.
     */
    public function streamRecording(Request $request, string $uniqueid)
    {
        $settings = $this->epbxService->getSettings();
        $baseUrl = rtrim($settings->api_base_url, '/');

        if (empty($settings->api_token)) {
            abort(401, 'ePBX API Token is not configured.');
        }

        $uniqueid = basename($uniqueid);

        try {
            $response = Http::timeout(25)
                ->withToken($settings->api_token)
                ->get("{$baseUrl}/calls/recordings/{$uniqueid}");

            if ($response->successful()) {
                $contentType = $response->header('Content-Type') ?: 'audio/wav';
                $body = $response->body();

                return response($body, 200, [
                    'Content-Type' => $contentType,
                    'Content-Length' => strlen($body),
                    'Accept-Ranges' => 'bytes',
                    'Content-Disposition' => 'inline; filename="call_' . $uniqueid . '.wav"',
                    'Cache-Control' => 'public, max-age=86400',
                ]);
            }

            return response('Recording unavailable or expired on ePBX server.', $response->status());
        } catch (\Throwable $e) {
            return response('Error fetching recording: ' . $e->getMessage(), 500);
        }
    }
}

