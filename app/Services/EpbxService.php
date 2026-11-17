<?php

namespace App\Services;

use App\Models\CallLog;
use App\Models\Customer;
use App\Models\EpbxSetting;
use App\Models\Order;
use App\Services\WooCommerceService;
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
            // ePBX.bd official endpoints: /ping, /balance/global, /balance/ip
            $pingRes = Http::timeout(8)
                ->withToken($settings->api_token)
                ->acceptJson()
                ->get("{$baseUrl}/ping");

            $globalBalanceRes = Http::timeout(8)
                ->withToken($settings->api_token)
                ->acceptJson()
                ->get("{$baseUrl}/balance/global");

            $ipBalanceRes = Http::timeout(8)
                ->withToken($settings->api_token)
                ->acceptJson()
                ->get("{$baseUrl}/balance/ip");

            if ($globalBalanceRes->successful() || $ipBalanceRes->successful() || $pingRes->successful()) {
                $globalData = $globalBalanceRes->successful() ? $globalBalanceRes->json() : [];
                $ipData = $ipBalanceRes->successful() ? $ipBalanceRes->json() : [];
                
                $balance = $globalData['balance'] ?? $ipData['balance'] ?? $settings->last_balance;
                $trunkFromApi = $ipData['trunk_username'] ?? null;

                $updateData = [
                    'last_balance' => $balance !== null ? (float) $balance : $settings->last_balance,
                    'last_checked_at' => now(),
                ];

                if (! empty($trunkFromApi) && empty($settings->trunk_number)) {
                    $updateData['trunk_number'] = $trunkFromApi;
                }

                $settings->update($updateData);

                return [
                    'success' => true,
                    'message' => 'Successfully connected to ePBX.bd server!',
                    'balance' => $settings->last_balance,
                    'data' => [
                        'global' => $globalData,
                        'ip_trunk' => $ipData,
                    ],
                ];
            }

            $errMsg = $globalBalanceRes->json('message') ?? $pingRes->json('message') ?? 'HTTP ' . $globalBalanceRes->status();

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
            // ePBX.bd originate endpoint: POST /calls/originate
            $payload = [
                'extension' => (string) $extension,
                'phone_number' => $formattedPhone,
                'destination' => $formattedPhone,
                'caller_id' => $trunk,
                'webhook_url' => url('/api/webhooks/epbx'),
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
     * Send an Outbound Dynamic AI Voice Order Verification Call via ePBX.bd.
     */
    public function sendOrderVerificationCall(Order $order, ?string $customScript = null): array
    {
        $settings = $this->getSettings();
        $rawPhone = $order->customer_phone ?: ($order->customer?->phone ?: '');
        $formattedPhone = $this->formatPhoneNumber($rawPhone);

        if (strlen($formattedPhone) < 10) {
            return [
                'success' => false,
                'message' => 'সঠিক ১১ ডিজিটের ফোন নম্বর পাওয়া যায়নি। অর্ডার নম্বর: ' . ($order->order_number ?: '#' . $order->id),
            ];
        }

        // 1. Resolve Customer Name
        $customerName = trim((string) ($order->customer?->name ?: ($order->wc_raw_data['billing']['first_name'] ?? '')));
        if (empty($customerName) || $customerName === 'Website Customer') {
            $customerName = 'সম্মানিত গ্রাহক';
        }

        // 2. Resolve Product Name
        $productName = 'আপনার পছন্দের পণ্য';
        if (! empty($order->items_data) && is_array($order->items_data)) {
            $firstItem = $order->items_data[0] ?? [];
            $firstItemName = trim((string) ($firstItem['name'] ?? ''));
            $itemCount = count($order->items_data);
            if (! empty($firstItemName)) {
                $productName = $itemCount > 1 ? "{$firstItemName} সহ মোট {$itemCount}টি পণ্য" : $firstItemName;
            }
        } elseif ($order->product && ! empty($order->product->name)) {
            $productName = $order->product->name;
        }

        // 3. Resolve Amount
        $amount = (int) round((float) $order->total_amount);

        // 4. Compile Dynamic Bangla TTS Text
        $defaultCustomText = 'আসসালামু আলাইকুম {customer_name}, আপনি অলিরো থেকে {product_name} অর্ডার করেছেন। পণ্যটির মূল্য {amount} টাকা। অর্ডার কনফার্ম করতে ১ চাপুন। অর্ডার ক্যানসেল করতে ২ চাপুন।';
        $template = $customScript ?: ($settings->order_call_custom_text ?: $defaultCustomText);
        $customText = str_replace(
            ['{customer_name}', '{product_name}', '{amount}', '{store_name}'],
            [$customerName, $productName, (string) $amount, 'অলিরো'],
            $template
        );

        $confirmText = $settings->order_call_confirm_text ?: 'অর্ডারটি কনফার্ম করা হয়েছে। ধন্যবাদ।';
        $cancelText = $settings->order_call_cancel_text ?: 'আপনার অর্ডারটি ক্যানসেল করা হয়েছে। ক্যানসেলের কারণ জানতে আমাদের একজন প্রতিনিধি আপনার সাথে যোগাযোগ করতে পারেন। অনুগ্রহ করে সহযোগিতা করবেন। ধন্যবাদ।';

        $trunk = $settings->trunk_number ?: '09639666896';
        $callSessionId = 'epbx_ai_' . ($order->wc_order_id ?: $order->id) . '_' . time();

        // Create initial CallLog
        $callLog = CallLog::create([
            'call_session_id' => $callSessionId,
            'direction' => 'outbound',
            'customer_phone' => $formattedPhone,
            'customer_id' => $order->customer_id,
            'order_id' => $order->id,
            'agent_extension' => $settings->order_call_agent_extension ?: 'AI_IVR',
            'trunk_number' => $trunk,
            'status' => 'initiated',
            'notes' => "AI Voice Order Verification Call to {$customerName} ({$formattedPhone})",
            'started_at' => now(),
        ]);

        // If mock / demo mode
        if (str_starts_with((string) $settings->api_token, 'mock_') || $settings->api_token === 'epbx_test_token' || empty($settings->api_token)) {
            $order->update([
                'ai_call_status' => 'calling',
                'ai_call_session_id' => $callSessionId,
                'ai_call_count' => ($order->ai_call_count ?? 0) + 1,
                'ai_call_last_at' => now(),
                'ai_call_notes' => 'AI ভেরিফিকেশন কল সফলভাবে ডায়াল করা হয়েছে (Demo Sandbox)।',
            ]);

            return [
                'success' => true,
                'message' => "AI ভেরিফিকেশন কল {$formattedPhone} নম্বরে পাঠানো হয়েছে (Demo Sandbox Mode)।",
                'order' => $order->fresh(),
                'call_log' => $callLog,
            ];
        }

        $baseUrl = rtrim($settings->api_base_url, '/');

        try {
            $payload = [
                'phone_number' => $formattedPhone,
                'caller_id' => $trunk,
                'customer_name' => $customerName,
                'amount' => "{$amount} BDT",
                'store_name' => 'অলিরো',
                'order_id' => (string) ($order->wc_order_id ?: $order->id),
                'custom_text' => $customText,
                'confirm_text' => $confirmText,
                'cancel_text' => $cancelText,
                'key_1_action' => $settings->order_call_key_1_action ?: 'hangup',
                'key_2_action' => $settings->order_call_key_2_action ?: 'hangup',
                'webhook_url' => url('/api/webhooks/epbx'),
            ];

            if (! empty($settings->order_call_agent_extension)) {
                $payload['agent_extension'] = $settings->order_call_agent_extension;
            }

            $response = Http::timeout(12)
                ->withToken($settings->api_token)
                ->acceptJson()
                ->post("{$baseUrl}/calls/verify", $payload);

            if (! $response->successful()) {
                // Fallback attempt: check alternate endpoint
                $response = Http::timeout(12)
                    ->withToken($settings->api_token)
                    ->acceptJson()
                    ->post("{$baseUrl}/calls/order-verification", $payload);
            }

            if ($response->successful()) {
                $resData = $response->json();
                $remoteCallId = $resData['call_id'] ?? $resData['session_id'] ?? $resData['data']['call_id'] ?? $callSessionId;

                $order->update([
                    'ai_call_status' => 'calling',
                    'ai_call_session_id' => $remoteCallId,
                    'ai_call_count' => ($order->ai_call_count ?? 0) + 1,
                    'ai_call_last_at' => now(),
                    'ai_call_notes' => 'AI কল পাঠানো হয়েছে। কাস্টমারের রেসপন্সের অপেক্ষা করা হচ্ছে।',
                ]);

                $callLog->update([
                    'call_session_id' => $remoteCallId,
                    'status' => 'ringing',
                ]);

                return [
                    'success' => true,
                    'message' => "AI ভেরিফিকেশন কল সফলভাবে {$formattedPhone} নম্বরে পাঠানো হয়েছে!",
                    'order' => $order->fresh(),
                    'call_log' => $callLog->fresh(),
                    'data' => $resData,
                ];
            }

            $errMsg = $response->json('message') ?? $response->json('error') ?? ('HTTP ' . $response->status());
            $order->update([
                'ai_call_status' => 'failed',
                'ai_call_notes' => 'ePBX API Error: ' . $errMsg,
            ]);
            $callLog->update(['status' => 'failed', 'notes' => 'API Error: ' . $errMsg]);

            return [
                'success' => false,
                'message' => 'ePBX API ত্রুটি: ' . $errMsg,
                'order' => $order->fresh(),
            ];
        } catch (\Throwable $e) {
            Log::error('ePBX Order Verification Exception: ' . $e->getMessage(), ['order_id' => $order->id]);
            $order->update([
                'ai_call_status' => 'failed',
                'ai_call_notes' => 'Error: ' . $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'ePBX সার্ভারে কানেক্ট করতে ব্যর্থ: ' . $e->getMessage(),
                'order' => $order->fresh(),
            ];
        }
    }

    /**
     * Process incoming CDR / recording / order verification webhook from ePBX.bd.
     */
    public function processWebhook(array $payload): bool
    {
        $callId = $payload['call_id'] ?? $payload['session_id'] ?? $payload['custom_id'] ?? null;
        $orderIdentifier = $payload['order_id'] ?? null;
        $destination = $payload['destination'] ?? $payload['phone_number'] ?? $payload['customer_phone'] ?? null;
        $statusRaw = $payload['status'] ?? '';
        $statusStr = strtolower(trim((string) $statusRaw));
        $recordingUrl = $payload['recording_url'] ?? $payload['audio_url'] ?? null;
        $duration = (int) ($payload['duration'] ?? $payload['duration_seconds'] ?? $payload['billsec'] ?? 0);
        $digitPressed = (string) ($payload['digit_pressed'] ?? '');

        // --- 1. HANDLE ORDER AI VERIFICATION CALLBACK ---
        $order = null;
        if ($orderIdentifier) {
            $order = Order::where('wc_order_id', is_numeric($orderIdentifier) ? (int) $orderIdentifier : 0)
                ->orWhere('id', is_numeric($orderIdentifier) ? (int) $orderIdentifier : 0)
                ->orWhere('order_number', (string) $orderIdentifier)
                ->orWhere('order_number', '#' . $orderIdentifier)
                ->first();
        }

        if (! $order && $callId) {
            $order = Order::where('ai_call_session_id', $callId)->first();
        }

        if (! $order && $destination) {
            $cleanPhone = $this->formatPhoneNumber($destination);
            $order = Order::where('customer_phone', $cleanPhone)->latest()->first();
        }

        if ($order) {
            $wcService = app(WooCommerceService::class);
            $existingNotes = $order->ai_call_notes ? ($order->ai_call_notes . "\n") : '';

            if ($statusStr === 'confirmed' || $digitPressed === '1') {
                $order->update([
                    'order_status' => 'processing',
                    'ai_call_status' => 'confirmed',
                    'ai_call_recording_url' => $recordingUrl ?: $order->ai_call_recording_url,
                    'ai_call_notes' => $existingNotes . '✅ কাস্টমার ফোনে ১ চেপে অর্ডার কনফার্ম করেছেন।',
                ]);

                // Sync status update to WooCommerce website!
                if ($order->wc_order_id) {
                    $wcService->updateOrderStatusInWooCommerce($order->wc_order_id, 'processing');
                }
            } elseif ($statusStr === 'rejected' || $statusStr === 'cancelled' || $digitPressed === '2') {
                $order->update([
                    'order_status' => 'cancelled',
                    'ai_call_status' => 'rejected',
                    'ai_call_recording_url' => $recordingUrl ?: $order->ai_call_recording_url,
                    'ai_call_notes' => $existingNotes . '❌ কাস্টমার ফোনে ২ চেপে অর্ডার ক্যানসেল করেছেন।',
                ]);

                // Sync status update to WooCommerce website!
                if ($order->wc_order_id) {
                    $wcService->updateOrderStatusInWooCommerce($order->wc_order_id, 'cancelled');
                }
            } elseif (in_array($statusStr, ['no answer', 'noanswer', 'unanswered'])) {
                $order->update([
                    'ai_call_status' => 'no_answer',
                    'ai_call_recording_url' => $recordingUrl ?: $order->ai_call_recording_url,
                    'ai_call_notes' => $existingNotes . '📞 কাস্টমারের ফোন রিং হয়েছে কিন্তু রিসিভ করেননি (NOANSWER)।',
                ]);
            } elseif (in_array($statusStr, ['busy', 'rejected_call'])) {
                $order->update([
                    'ai_call_status' => 'busy',
                    'ai_call_recording_url' => $recordingUrl ?: $order->ai_call_recording_url,
                    'ai_call_notes' => $existingNotes . '📵 কাস্টমার কল কেটে দিয়েছেন বা নম্বর ব্যস্ত ছিল (BUSY)।',
                ]);
            } elseif (str_contains($statusStr, 'no response')) {
                $order->update([
                    'ai_call_status' => 'no_answer',
                    'ai_call_recording_url' => $recordingUrl ?: $order->ai_call_recording_url,
                    'ai_call_notes' => $existingNotes . '⚠️ কাস্টমার ফোন ধরেছিলেন কিন্তু কোনো বাটন প্রেস করেননি (No Response)।',
                ]);
            } elseif (in_array($statusStr, ['congestion', 'chanunavail', 'failed'])) {
                $order->update([
                    'ai_call_status' => 'failed',
                    'ai_call_recording_url' => $recordingUrl ?: $order->ai_call_recording_url,
                    'ai_call_notes' => $existingNotes . '❌ কাস্টমারের ফোন বন্ধ বা নেটওয়ার্কের বাইরে ছিল (Unreachable)।',
                ]);
            }
        }

        // --- 2. UPDATE OR CREATE CALL LOG ---
        $mappedStatus = match ($statusStr) {
            'confirmed', 'answered', 'completed', 'success' => 'answered',
            'busy' => 'busy',
            'no answer', 'noanswer', 'unanswered', 'rejected' => 'no_answer',
            'failed', 'congestion', 'chanunavail' => 'failed',
            default => 'answered',
        };

        $callLog = null;
        if ($callId) {
            $callLog = CallLog::where('call_session_id', $callId)
                ->orWhere('id', is_numeric($callId) ? (int) $callId : 0)
                ->first();
        }

        if (! $callLog && $order) {
            $callLog = CallLog::where('order_id', $order->id)->latest()->first();
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
                'order_id' => $callLog->order_id ?: $order?->id,
                'duration_seconds' => $duration > 0 ? $duration : (int) ($payload['duration'] ?? $payload['duration_seconds'] ?? $callLog->duration_seconds),
                'recording_url' => $recordingUrl ?: ($payload['audio_url'] ?? $callLog->recording_url),
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

    /**
     * Fetch and sync call history directly from ePBX.bd server.
     */
    public function syncCallHistory(int $perPage = 25): array
    {
        $settings = $this->getSettings();
        if (empty($settings->api_token)) {
            return ['success' => false, 'message' => 'API token missing'];
        }

        $baseUrl = rtrim($settings->api_base_url, '/');
        try {
            $response = Http::timeout(15)
                ->withToken($settings->api_token)
                ->acceptJson()
                ->get("{$baseUrl}/calls/history", [
                    'per_page' => $perPage,
                ]);

            if ($response->successful()) {
                $items = $response->json('data') ?? [];
                $imported = 0;
                foreach ($items as $item) {
                    $uniqueId = $item['call_id'] ?? $item['uniqueid'] ?? $item['id'] ?? null;
                    if (! $uniqueId) {
                        continue;
                    }

                    $dest = $item['destination'] ?? $item['phone_number'] ?? '';
                    $cleanPhone = $this->formatPhoneNumber($dest);
                    $customer = Customer::where('phone', $cleanPhone)
                        ->orWhere('phone', '+88' . $cleanPhone)
                        ->orWhere('phone', '88' . $cleanPhone)
                        ->first();
                    $disp = strtoupper($item['disposition'] ?? 'ANSWERED');
                    $status = match ($disp) {
                        'ANSWERED' => 'answered',
                        'BUSY' => 'busy',
                        'NO ANSWER' => 'no_answer',
                        'FAILED' => 'failed',
                        default => 'answered',
                    };

                    $duration = (int) ($item['billable_seconds'] ?? $item['duration_seconds'] ?? $item['billsec'] ?? $item['duration'] ?? 0);
                    $callDate = ! empty($item['date']) ? $item['date'] : (! empty($item['call_date']) ? $item['call_date'] : now());

                    // Use our proxy streaming endpoint for seamless, authenticated in-browser playback
                    $recordingUrl = url("/api/call-center/recordings/{$uniqueId}");

                    // 1. Check if record with this uniqueId already exists
                    $existingLog = CallLog::where('call_session_id', (string) $uniqueId)->first();

                    // 2. If not, check if a WebRTC in-browser log was saved around the same time
                    if (! $existingLog && ! empty($cleanPhone)) {
                        $existingLog = CallLog::where('customer_phone', $cleanPhone)
                            ->where(function ($q) {
                                $q->where('call_session_id', 'like', 'webrtc_%')
                                  ->orWhereNull('recording_url');
                            })
                            ->latest('id')
                            ->first();
                    }

                    if ($existingLog) {
                        $existingLog->update([
                            'call_session_id' => (string) $uniqueId,
                            'status' => $status,
                            'duration_seconds' => $duration > 0 ? $duration : $existingLog->duration_seconds,
                            'recording_url' => $recordingUrl,
                            'started_at' => $callDate,
                        ]);
                    } else {
                        CallLog::create([
                            'call_session_id' => (string) $uniqueId,
                            'direction' => 'outbound',
                            'customer_phone' => $cleanPhone ?: $dest,
                            'customer_id' => $customer?->id,
                            'agent_extension' => (string) ($item['source'] ?? $settings->default_extension ?: '102'),
                            'trunk_number' => $settings->trunk_number,
                            'status' => $status,
                            'duration_seconds' => $duration,
                            'recording_url' => $recordingUrl,
                            'started_at' => $callDate,
                        ]);
                    }
                    $imported++;
                }

                return ['success' => true, 'message' => "Successfully synced {$imported} calls and recordings from ePBX.bd."];
            }

            return ['success' => false, 'message' => 'ePBX History sync failed: ' . $response->body()];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

