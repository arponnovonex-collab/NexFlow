<?php

namespace App\Services;

use App\Models\CallLog;
use App\Models\Customer;
use App\Models\EpbxSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EpbxService
{
    /**
     * Get or initialize ePBX.bd configuration.
     */
    public function getSettings(): EpbxSetting
    {
        return EpbxSetting::firstOrCreate(
            ['provider' => 'epbx_bd'],
            [
                'api_base_url' => 'https://epbx.bd/api/v1',
                'api_token' => null,
                'trunk_number' => null,
                'default_extension' => '101',
                'webhook_secret' => bin2hex(random_bytes(16)),
                'is_enabled' => false,
                'last_balance' => null,
            ]
        );
    }

    /**
     * Format a Bangladeshi phone number to standard 11-digit or international format.
     */
    public function formatPhoneNumber(string $phone): string
    {
        // Strip everything except digits
        $digits = preg_replace('/[^0-9]/', '', $phone);

        // If begins with 880, strip 88 to get 11 digits (01XXXXXXXXX)
        if (str_starts_with($digits, '880') && strlen($digits) === 13) {
            return substr($digits, 2);
        }

        // If begins with 1 and is 10 digits (e.g. 17XXXXXXXX), prefix 0
        if (strlen($digits) === 10 && str_starts_with($digits, '1')) {
            return '0' . $digits;
        }

        return $digits;
    }

    /**
     * Test connection to ePBX.bd API and fetch account balance / profile.
     */
    public function testConnection(?EpbxSetting $settings = null): array
    {
        $settings = $settings ?: $this->getSettings();

        if (empty($settings->api_token)) {
            return [
                'success' => false,
                'message' => 'API Token is missing. Please enter your ePBX.bd Bearer Token.',
                'balance' => $settings->last_balance,
            ];
        }

        // Support mock testing token
        if (str_starts_with($settings->api_token, 'mock_') || $settings->api_token === 'epbx_test_token') {
            $settings->update([
                'last_balance' => 500.00,
                'last_checked_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => 'Connected successfully! (Sandbox/Demo Mode Active)',
                'balance' => 500.00,
            ];
        }

        $baseUrl = rtrim($settings->api_base_url, '/');

        try {
            // First try GET /balance or /account endpoint
            $response = Http::timeout(8)
                ->withToken($settings->api_token)
                ->acceptJson()
                ->get("{$baseUrl}/balance");

            if (! $response->successful()) {
                $response = Http::timeout(8)
                    ->withToken($settings->api_token)
                    ->acceptJson()
                    ->get("{$baseUrl}/account");
            }

            if ($response->successful()) {
                $data = $response->json();
                $balance = $data['balance'] ?? $data['data']['balance'] ?? $data['credit'] ?? null;

                $settings->update([
                    'last_balance' => $balance !== null ? (float) $balance : $settings->last_balance,
                    'last_checked_at' => now(),
                ]);

                return [
                    'success' => true,
                    'message' => 'Successfully connected to ePBX.bd server!',
                    'balance' => $settings->last_balance,
                    'data' => $data,
                ];
            }

            $errMsg = $response->json('message') ?? $response->json('error') ?? 'HTTP ' . $response->status();

            return [
                'success' => false,
                'message' => 'ePBX.bd API verification failed: ' . $errMsg,
                'balance' => $settings->last_balance,
            ];
        } catch (\Throwable $e) {
            Log::warning('ePBX.bd Connection Check Failed: ' . $e->getMessage());

            return [
                'success' => false,
                'message' => 'Could not reach ePBX.bd server: ' . $e->getMessage(),
                'balance' => $settings->last_balance,
            ];
        }
    }

    /**
     * Originate a Click-to-Call request via ePBX.bd.
     */
    public function originateCall(string $customerPhone, ?string $agentExtension = null, ?int $agentUserId = null): array
    {
        $settings = $this->getSettings();
        $formattedPhone = $this->formatPhoneNumber($customerPhone);

        if (strlen($formattedPhone) < 10) {
            return [
                'success' => false,
                'message' => 'Invalid phone number. Please enter a valid Bangladeshi phone number.',
            ];
        }

        $extension = $agentExtension ?: ($settings->default_extension ?: '101');
        $trunk = $settings->trunk_number;

        // Find customer if exists in NexFlow CRM
        $customer = Customer::where('phone', $formattedPhone)
            ->orWhere('phone', '+88' . $formattedPhone)
            ->orWhere('phone', '88' . $formattedPhone)
            ->first();

        // Create initial CallLog
        $callLog = CallLog::create([
            'call_session_id' => 'epbx_' . uniqid() . '_' . time(),
            'direction' => 'outbound',
            'customer_phone' => $formattedPhone,
            'customer_id' => $customer?->id,
            'agent_user_id' => $agentUserId,
            'agent_extension' => $extension,
            'trunk_number' => $trunk,
            'status' => 'initiated',
            'started_at' => now(),
        ]);

        // If mock / demo token
        if (str_starts_with((string) $settings->api_token, 'mock_') || $settings->api_token === 'epbx_test_token' || empty($settings->api_token)) {
            $callLog->update([
                'status' => 'ringing',
            ]);

            return [
                'success' => true,
                'message' => "Call initiated to {$formattedPhone} via Extension {$extension}. (Demo Simulation)",
                'call_log' => $callLog->load(['customer', 'agent']),
            ];
        }

        $baseUrl = rtrim($settings->api_base_url, '/');

        try {
            // ePBX.bd originate endpoint: POST /calls/originate or /click-to-call
            $payload = [
                'extension' => (string) $extension,
                'destination' => $formattedPhone,
                'caller_id' => $trunk,
                'custom_id' => (string) $callLog->id,
            ];

            $response = Http::timeout(10)
                ->withToken($settings->api_token)
                ->acceptJson()
                ->post("{$baseUrl}/calls/originate", $payload);

            if (! $response->successful()) {
                // Try alternate endpoint /click-to-call
                $response = Http::timeout(10)
                    ->withToken($settings->api_token)
                    ->acceptJson()
                    ->post("{$baseUrl}/click-to-call", $payload);
            }

            if ($response->successful()) {
                $resData = $response->json();
                $remoteSessionId = $resData['call_id'] ?? $resData['data']['call_id'] ?? $resData['session_id'] ?? $callLog->call_session_id;

                $callLog->update([
                    'call_session_id' => $remoteSessionId,
                    'status' => 'ringing',
                ]);

                return [
                    'success' => true,
                    'message' => "Calling Extension {$extension}. Once answered, customer {$formattedPhone} will be connected.",
                    'call_log' => $callLog->fresh()->load(['customer', 'agent']),
                ];
            }

            $errMsg = $response->json('message') ?? $response->json('error') ?? 'HTTP ' . $response->status();
            $callLog->update(['status' => 'failed', 'notes' => 'API Error: ' . $errMsg]);

            return [
                'success' => false,
                'message' => 'ePBX.bd Error: ' . $errMsg,
                'call_log' => $callLog->fresh(),
            ];
        } catch (\Throwable $e) {
            Log::error('ePBX Originate Exception: ' . $e->getMessage());
            $callLog->update(['status' => 'failed', 'notes' => 'Exception: ' . $e->getMessage()]);

            return [
                'success' => false,
                'message' => 'Failed to connect to ePBX server: ' . $e->getMessage(),
                'call_log' => $callLog->fresh(),
            ];
        }
    }

    /**
     * Process incoming CDR / recording webhook from ePBX.bd.
     */
    public function processWebhook(array $payload): bool
    {
        $callId = $payload['call_id'] ?? $payload['session_id'] ?? $payload['custom_id'] ?? null;
        $destination = $payload['destination'] ?? $payload['customer_phone'] ?? null;
        $statusStr = strtolower((string) ($payload['status'] ?? ''));

        $mappedStatus = match ($statusStr) {
            'answered', 'completed', 'success' => 'answered',
            'busy' => 'busy',
            'no answer', 'no_answer', 'cancelled' => 'no_answer',
            'failed' => 'failed',
            default => 'answered',
        };

        $callLog = null;
        if ($callId) {
            $callLog = CallLog::where('call_session_id', $callId)
                ->orWhere('id', is_numeric($callId) ? (int) $callId : 0)
                ->first();
        }

        if (! $callLog && $destination) {
            $clean = $this->formatPhoneNumber($destination);
            $callLog = CallLog::where('customer_phone', $clean)
                ->latest()
                ->first();
        }

        if ($callLog) {
            $callLog->update([
                'status' => $mappedStatus,
                'duration_seconds' => (int) ($payload['duration'] ?? $payload['duration_seconds'] ?? $callLog->duration_seconds),
                'recording_url' => $payload['recording_url'] ?? $payload['audio_url'] ?? $callLog->recording_url,
                'cost' => (float) ($payload['cost'] ?? $callLog->cost),
                'answered_at' => ! empty($payload['answer_time']) ? $payload['answer_time'] : ($mappedStatus === 'answered' ? now() : null),
                'ended_at' => ! empty($payload['end_time']) ? $payload['end_time'] : now(),
            ]);

            return true;
        }

        // If inbound call initiated directly from customer to ePBX
        if ($destination || ! empty($payload['caller'])) {
            $customerPhone = $this->formatPhoneNumber($payload['caller'] ?? $destination);
            $customer = Customer::where('phone', 'like', "%{$customerPhone}%")->first();

            CallLog::create([
                'call_session_id' => $callId ?: ('epbx_in_' . uniqid()),
                'direction' => 'inbound',
                'customer_phone' => $customerPhone,
                'customer_id' => $customer?->id,
                'agent_extension' => (string) ($payload['extension'] ?? '101'),
                'trunk_number' => $payload['trunk'] ?? null,
                'status' => $mappedStatus,
                'duration_seconds' => (int) ($payload['duration'] ?? 0),
                'recording_url' => $payload['recording_url'] ?? null,
                'started_at' => ! empty($payload['start_time']) ? $payload['start_time'] : now(),
                'ended_at' => ! empty($payload['end_time']) ? $payload['end_time'] : now(),
            ]);

            return true;
        }

        return false;
    }
}
