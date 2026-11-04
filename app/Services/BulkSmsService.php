<?php

namespace App\Services;

use App\Models\Order;
use App\Models\SmsCampaign;
use App\Models\SmsLog;
use App\Models\SmsSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BulkSmsService
{
    protected string $apiUrl = 'https://bulksmsbd.net/api/smsapi';
    protected string $balanceUrl = 'https://bulksmsbd.net/api/getBalanceApi';

    /**
     * Get or initialize SMS Settings.
     */
    public function getSettings(): SmsSetting
    {
        return SmsSetting::firstOrCreate(
            ['provider' => 'bulksmsbd'],
            [
                'api_key' => null,
                'sender_id' => null,
                'is_enabled' => false,
                'auto_sms_enabled' => true,
                'auto_sms_template' => "Dear {customer_name}, apnar order #{order_id} grohon kora hoyeche. Total: {total_amount} TK. Dhonnobad NexFlow.",
            ]
        );
    }

    /**
     * Clean and format Bangladeshi phone number.
     */
    public function formatPhoneNumber(string $phone): string
    {
        // Remove all non-digit characters
        $cleaned = preg_replace('/[^0-9]/', '', $phone);

        // If begins with 880, keep 880
        if (str_starts_with($cleaned, '880') && strlen($cleaned) === 13) {
            return $cleaned;
        }

        // If standard 11 digits starting with 01, prefix 88
        if (str_starts_with($cleaned, '01') && strlen($cleaned) === 11) {
            return '88' . $cleaned;
        }

        // If 10 digits starting with 1, prefix 880
        if (str_starts_with($cleaned, '1') && strlen($cleaned) === 10) {
            return '880' . $cleaned;
        }

        return $cleaned;
    }

    /**
     * Check current account balance from BulkSMS BD.
     */
    public function checkBalance(): array
    {
        $settings = $this->getSettings();

        if (empty($settings->api_key)) {
            return [
                'success' => false,
                'message' => 'BulkSMS BD API Key / Token is not configured.',
                'balance' => 0.00,
            ];
        }

        try {
            $response = Http::timeout(8)->get($this->balanceUrl, [
                'api_key' => $settings->api_key,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $code = (int) ($data['response_code'] ?? 0);

                if ($code === 202) {
                    $balance = (float) ($data['balance'] ?? 0.00);
                    $settings->update([
                        'last_balance' => $balance,
                        'last_balance_checked_at' => now(),
                    ]);

                    return [
                        'success' => true,
                        'balance' => $balance,
                        'message' => 'Balance fetched successfully.',
                    ];
                }

                return [
                    'success' => false,
                    'message' => $data['error_message'] ?? 'Failed to retrieve balance from BulkSMS BD.',
                    'balance' => $settings->last_balance ?? 0.00,
                ];
            }
        } catch (\Exception $e) {
            Log::error('BulkSmsService checkBalance error: ' . $e->getMessage());
        }

        return [
            'success' => false,
            'message' => 'Connection to BulkSMS BD failed.',
            'balance' => $settings->last_balance ?? 0.00,
        ];
    }

    /**
     * Send a single SMS.
     */
    public function sendSms(
        string $number,
        string $message,
        string $type = 'manual',
        ?int $orderId = null,
        ?int $customerId = null,
        ?int $campaignId = null
    ): array {
        $settings = $this->getSettings();
        $formattedPhone = $this->formatPhoneNumber($number);

        // Validation
        if (empty($settings->api_key)) {
            return $this->logAndFail($formattedPhone, $message, $type, 'BulkSMS BD API Key / Token is not set.', $orderId, $customerId, $campaignId);
        }

        if (! $settings->is_enabled && $type !== 'test') {
            return $this->logAndFail($formattedPhone, $message, $type, 'SMS Gateway is currently disabled in settings.', $orderId, $customerId, $campaignId);
        }

        if (strlen($formattedPhone) < 11) {
            return $this->logAndFail($formattedPhone, $message, $type, 'Invalid Bangladeshi mobile number format.', $orderId, $customerId, $campaignId);
        }

        try {
            $params = [
                'api_key' => $settings->api_key,
                'type' => 'text',
                'number' => $formattedPhone,
                'message' => $message,
            ];

            if (! empty($settings->sender_id)) {
                $params['senderid'] = $settings->sender_id;
            }

            $response = Http::timeout(10)->asForm()->post($this->apiUrl, $params);

            if ($response->successful()) {
                $data = $response->json();
                $code = (int) ($data['response_code'] ?? 0);

                if ($code === 202) {
                    $log = SmsLog::create([
                        'campaign_id' => $campaignId,
                        'order_id' => $orderId,
                        'customer_id' => $customerId,
                        'phone_number' => $formattedPhone,
                        'message' => $message,
                        'type' => $type,
                        'status' => 'sent',
                        'response_code' => (string) $code,
                        'error_message' => null,
                    ]);

                    return [
                        'success' => true,
                        'message' => 'SMS submitted successfully via BulkSMS BD.',
                        'response_code' => $code,
                        'log_id' => $log->id,
                    ];
                }

                $errMsg = $data['error_message'] ?? 'BulkSMS BD error code: ' . $code;
                return $this->logAndFail($formattedPhone, $message, $type, $errMsg, $orderId, $customerId, $campaignId, (string) $code);
            }

            return $this->logAndFail($formattedPhone, $message, $type, 'HTTP Request failed: ' . $response->status(), $orderId, $customerId, $campaignId);
        } catch (\Exception $e) {
            Log::error('BulkSmsService sendSms exception: ' . $e->getMessage());
            return $this->logAndFail($formattedPhone, $message, $type, $e->getMessage(), $orderId, $customerId, $campaignId);
        }
    }

    /**
     * Trigger Automatic Order Confirmation SMS.
     */
    public function sendAutoOrderSms(Order $order): array
    {
        $settings = $this->getSettings();

        if (! $settings->is_enabled || ! $settings->auto_sms_enabled) {
            return [
                'skipped' => true,
                'message' => 'Auto SMS on order creation is disabled.',
            ];
        }

        $phone = $order->customer_phone ?: $order->customer?->phone;
        if (empty($phone)) {
            return [
                'skipped' => true,
                'message' => 'Order has no customer phone number.',
            ];
        }

        $template = $settings->auto_sms_template ?: "Dear {customer_name}, apnar order #{order_id} grohon kora hoyeche. Total: {total_amount} TK. Dhonnobad NexFlow.";

        $productName = $order->product?->name ?? 'Product';
        $variantText = '';
        if ($order->variant) {
            $parts = [];
            if ($order->variant->size) $parts[] = $order->variant->size;
            if ($order->variant->color) $parts[] = $order->variant->color;
            if (!empty($parts)) $variantText = ' (' . implode(', ', $parts) . ')';
        }

        $replacements = [
            '{customer_name}' => $order->customer?->name ?? 'Customer',
            '{order_id}' => $order->order_number,
            '{product_name}' => $productName . $variantText,
            '{quantity}' => (string) $order->quantity,
            '{unit_price}' => (string) $order->unit_price,
            '{delivery_charge}' => (string) $order->delivery_charge,
            '{total_amount}' => (string) $order->total_amount,
            '{phone}' => $phone,
            '{address}' => $order->customer_address ?? '',
        ];

        $renderedMessage = str_replace(array_keys($replacements), array_values($replacements), $template);

        return $this->sendSms(
            number: $phone,
            message: $renderedMessage,
            type: 'auto_order',
            orderId: $order->id,
            customerId: $order->customer_id
        );
    }

    /**
     * Helper to log failed SMS attempt.
     */
    protected function logAndFail(
        string $phone,
        string $message,
        string $type,
        string $error,
        ?int $orderId = null,
        ?int $customerId = null,
        ?int $campaignId = null,
        ?string $code = null
    ): array {
        SmsLog::create([
            'campaign_id' => $campaignId,
            'order_id' => $orderId,
            'customer_id' => $customerId,
            'phone_number' => $phone,
            'message' => $message,
            'type' => $type,
            'status' => 'failed',
            'response_code' => $code,
            'error_message' => $error,
        ]);

        return [
            'success' => false,
            'message' => $error,
            'response_code' => $code,
        ];
    }
}

