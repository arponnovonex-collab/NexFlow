<?php

namespace App\Services;

use App\Models\CourierSetting;
use App\Models\Order;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SteadfastCourierService
{
    /**
     * Steadfast Courier API (v1 hosted via Packzy).
     */
    protected string $baseUrl = 'https://portal.packzy.com/api/v1';

    /**
     * Get or initialize Steadfast configuration.
     */
    public function getSettings(): CourierSetting
    {
        return CourierSetting::firstOrCreate(
            ['provider' => 'steadfast'],
            [
                'api_key' => null,
                'secret_key' => null,
                'is_enabled' => false,
                'contact_name' => 'Auliro',
                'contact_phone' => '01333-447475',
                'delivery_type' => 'home',
                'last_balance' => null,
            ]
        );
    }

    /**
     * Format Bangladeshi phone for Steadfast (11 digits: 01XXXXXXXXX).
     */
    public function formatPhoneNumber(string $phone): string
    {
        $cleaned = preg_replace('/[^0-9]/', '', $phone);

        // If begins with 8801, strip 88 to make it 01XXXXXXXXX
        if (str_starts_with($cleaned, '8801') && strlen($cleaned) === 13) {
            return substr($cleaned, 2);
        }

        // If 10 digits starting with 1, prefix 0
        if (str_starts_with($cleaned, '1') && strlen($cleaned) === 10) {
            return '0' . $cleaned;
        }

        return $cleaned;
    }

    /**
     * Format invoice description string: "product name | product variation | quantity"
     */
    public function formatInvoiceDescription(Order $order): string
    {
        $productName = $order->product?->name ?? 'Product';
        $variantText = 'Standard';

        if ($order->variant) {
            $parts = [];
            if ($order->variant->size) {
                $parts[] = 'Size: ' . $order->variant->size;
            }
            if ($order->variant->color) {
                $parts[] = 'Color: ' . $order->variant->color;
            }
            if (! empty($parts)) {
                $variantText = implode(', ', $parts);
            }
        }

        return "{$productName} | {$variantText} | {$order->quantity}";
    }

    /**
     * Check Steadfast account balance.
     */
    public function checkBalance(): array
    {
        $settings = $this->getSettings();

        if (empty($settings->api_key) || empty($settings->secret_key)) {
            return [
                'success' => false,
                'message' => 'Steadfast API Key or Secret Key is missing.',
                'balance' => 0.00,
            ];
        }

        try {
            $response = Http::timeout(8)->withHeaders([
                'Api-Key' => $settings->api_key,
                'Secret-Key' => $settings->secret_key,
                'Content-Type' => 'application/json',
            ])->get("{$this->baseUrl}/get_balance");

            if ($response->successful()) {
                $data = $response->json();
                if (($data['status'] ?? 0) === 200) {
                    $balance = (float) ($data['current_balance'] ?? 0.00);
                    $settings->update(['last_balance' => $balance]);

                    return [
                        'success' => true,
                        'balance' => $balance,
                        'message' => 'Balance fetched successfully.',
                    ];
                }

                return [
                    'success' => false,
                    'message' => $data['message'] ?? 'Failed to get Steadfast balance.',
                    'balance' => $settings->last_balance ?? 0.00,
                ];
            }
        } catch (\Exception $e) {
            Log::error('Steadfast checkBalance error: ' . $e->getMessage());
        }

        return [
            'success' => false,
            'message' => 'Could not connect to Steadfast Courier API.',
            'balance' => $settings->last_balance ?? 0.00,
        ];
    }

    /**
     * Send an order to Steadfast Courier.
     */
    public function sendOrder(Order $order): array
    {
        $settings = $this->getSettings();

        if (empty($settings->api_key) || empty($settings->secret_key)) {
            return [
                'success' => false,
                'message' => 'Steadfast API Key and Secret Key must be configured first in Steadfast Configuration.',
            ];
        }

        $phone = $this->formatPhoneNumber($order->customer_phone ?: $order->customer?->phone ?: '');
        if (strlen($phone) < 11) {
            return [
                'success' => false,
                'message' => "Invalid customer phone number for order #{$order->order_number}.",
            ];
        }

        if (empty($order->customer_address)) {
            return [
                'success' => false,
                'message' => "Order #{$order->order_number} has no delivery address.",
            ];
        }

        // Product details specified by user: "product name | product variation | quantity"
        $productDetails = $this->formatInvoiceDescription($order);
        $customerName = $order->customer?->name ?: 'Customer';

        // Steadfast requires `invoice` to strictly contain only letters, numbers, dashes and underscores (alpha_dash)
        $cleanInvoice = preg_replace('/[^A-Za-z0-9_-]/', '-', (string) $order->order_number);
        if (empty($cleanInvoice)) {
            $cleanInvoice = 'ORD-' . $order->id . '-' . time();
        }

        // Steadfast requires `delivery_type` to be an integer: 0 = Home Delivery, 1 = Point Delivery / Hub Pick Up
        $deliveryTypeInt = 0;
        if (in_array($settings->delivery_type, ['hub', 'point', '1', 1], true)) {
            $deliveryTypeInt = 1;
        }

        // Note with product details & customer note
        $noteContent = $productDetails;
        if (! empty($order->notes)) {
            $noteContent .= " | Note: {$order->notes}";
        }

        $payload = [
            'invoice' => $cleanInvoice,
            'recipient_name' => $customerName,
            'recipient_phone' => $phone,
            'recipient_address' => $order->customer_address,
            'cod_amount' => (float) $order->total_amount,
            'note' => $noteContent,
            'item_description' => $productDetails,
            'total_lot' => (int) ($order->quantity ?: 1),
            'delivery_type' => $deliveryTypeInt,
        ];

        try {
            $response = Http::timeout(12)->withHeaders([
                'Api-Key' => $settings->api_key,
                'Secret-Key' => $settings->secret_key,
                'Content-Type' => 'application/json',
            ])->post("{$this->baseUrl}/create_order", $payload);

            $data = $response->json();

            if ($response->successful() && ($data['status'] ?? 0) === 200 && isset($data['consignment'])) {
                $consignment = $data['consignment'];
                $consignmentId = (string) ($consignment['consignment_id'] ?? '');
                $trackingCode = (string) ($consignment['tracking_code'] ?? '');
                $status = (string) ($consignment['status'] ?? 'in_review');

                $order->update([
                    'courier_name' => 'steadfast',
                    'consignment_id' => $consignmentId,
                    'tracking_code' => $trackingCode,
                    'courier_status' => $status,
                    'courier_sent_at' => now(),
                    'courier_response' => $consignment,
                    'order_status' => 'processing',
                ]);

                return [
                    'success' => true,
                    'message' => "Order #{$order->order_number} successfully placed with Steadfast!",
                    'consignment_id' => $consignmentId,
                    'tracking_code' => $trackingCode,
                    'consignment' => $consignment,
                ];
            }

            // Extract error message
            $errorMessage = $data['message'] ?? 'Failed to create order on Steadfast.';
            if (isset($data['errors']) && is_array($data['errors'])) {
                $errorList = [];
                foreach ($data['errors'] as $field => $errs) {
                    $errorList[] = is_array($errs) ? implode(', ', $errs) : $errs;
                }
                $errorMessage .= ' (' . implode('; ', $errorList) . ')';
            }

            return [
                'success' => false,
                'message' => $errorMessage,
                'raw_response' => $data,
            ];
        } catch (\Exception $e) {
            Log::error('Steadfast sendOrder error: ' . $e->getMessage());

            return [
                'success' => false,
                'message' => 'Connection to Steadfast failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Send multiple orders in bulk to Steadfast.
     */
    public function sendBulkOrders(array $orderIds): array
    {
        $orders = Order::with(['customer', 'product', 'variant'])
            ->whereIn('id', $orderIds)
            ->get();

        $successList = [];
        $failedList = [];

        foreach ($orders as $order) {
            $res = $this->sendOrder($order);
            if ($res['success']) {
                $successList[] = [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'tracking_code' => $res['tracking_code'] ?? null,
                ];
            } else {
                $failedList[] = [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'error' => $res['message'],
                ];
            }
        }

        return [
            'total' => count($orders),
            'success_count' => count($successList),
            'failed_count' => count($failedList),
            'success_orders' => $successList,
            'failed_orders' => $failedList,
        ];
    }
}

