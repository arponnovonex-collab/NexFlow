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
     * Format invoice description string for Steadfast:
     * "Product Name | Product Variation | Quantity"
     * For multiple items, chained consecutively with " | ".
     */
    public function formatInvoiceDescription(Order $order): string
    {
        $items = [];

        // 1. Try to extract from items_data (WooCommerce multi-items or CRM order items)
        $rawItems = $order->items_data;
        if (empty($rawItems) && is_array($order->wc_raw_data) && ! empty($order->wc_raw_data['line_items'])) {
            $rawItems = $order->wc_raw_data['line_items'];
        }

        if (! empty($rawItems) && is_array($rawItems)) {
            foreach ($rawItems as $item) {
                $pName = trim((string) ($item['name'] ?? $item['product_name'] ?? ''));
                if (empty($pName)) {
                    $pName = $order->product?->name ?: 'Product';
                }

                // Extract variation details (Size, Color, etc.)
                $varParts = [];

                if (! empty($item['size'])) {
                    $varParts[] = 'Size: ' . trim($item['size']);
                }
                if (! empty($item['color'])) {
                    $varParts[] = 'Color: ' . trim($item['color']);
                }
                if (! empty($item['variation'])) {
                    $varParts[] = trim($item['variation']);
                }

                // If WooCommerce line item has meta_data
                if (! empty($item['meta_data']) && is_array($item['meta_data'])) {
                    foreach ($item['meta_data'] as $meta) {
                        $key = strtolower($meta['key'] ?? $meta['display_key'] ?? '');
                        $val = trim((string) ($meta['value'] ?? $meta['display_value'] ?? ''));
                        if (empty($val) || is_array($val)) continue;

                        if (str_contains($key, 'size') || str_contains($key, 'সাইজ')) {
                            $varParts[] = 'Size: ' . $val;
                        } elseif (str_contains($key, 'color') || str_contains($key, 'colour') || str_contains($key, 'কালার')) {
                            $varParts[] = 'Color: ' . $val;
                        }
                    }
                }

                // If only 1 item and no variation found yet, check order-level size/color
                if (empty($varParts) && count($rawItems) === 1) {
                    if (! empty($order->size)) {
                        $varParts[] = 'Size: ' . trim($order->size);
                    }
                    if (! empty($order->color)) {
                        $varParts[] = 'Color: ' . trim($order->color);
                    }
                }

                // If still empty, check order variant relationship
                if (empty($varParts) && count($rawItems) === 1 && $order->variant) {
                    if ($order->variant->size) $varParts[] = 'Size: ' . $order->variant->size;
                    if ($order->variant->color) $varParts[] = 'Color: ' . $order->variant->color;
                }

                // Clean product name if it already has variation appended like "Luna Ruby - 2-3 YEAR"
                $varParts = array_values(array_unique($varParts));
                foreach ($varParts as $vp) {
                    $cleanVp = preg_replace('/^(Size|Color):\s*/i', '', $vp);
                    if (! empty($cleanVp)) {
                        $pName = preg_replace('/\s*-\s*' . preg_quote($cleanVp, '/') . '$/i', '', $pName);
                    }
                }

                $varText = ! empty($varParts) ? implode(', ', $varParts) : '';
                $qty = (int) ($item['quantity'] ?? $item['qty'] ?? 1);

                if (! empty($varText)) {
                    $items[] = "{$pName} | {$varText} | {$qty}";
                } else {
                    $items[] = "{$pName} | {$qty}";
                }
            }
        }

        // 2. Fallback to order-level product, size, color, quantity
        if (empty($items)) {
            $pName = $order->product?->name ?: 'Product';
            if ($pName === 'Product' && is_array($order->wc_raw_data) && ! empty($order->wc_raw_data['line_items'])) {
                $pName = $order->wc_raw_data['line_items'][0]['name'] ?? 'Product';
            }

            $varParts = [];
            if (! empty($order->size)) {
                $varParts[] = 'Size: ' . trim($order->size);
            }
            if (! empty($order->color)) {
                $varParts[] = 'Color: ' . trim($order->color);
            }
            if (empty($varParts) && $order->variant) {
                if ($order->variant->size) $varParts[] = 'Size: ' . $order->variant->size;
                if ($order->variant->color) $varParts[] = 'Color: ' . $order->variant->color;
            }

            $varParts = array_values(array_unique($varParts));
            foreach ($varParts as $vp) {
                $cleanVp = preg_replace('/^(Size|Color):\s*/i', '', $vp);
                if (! empty($cleanVp)) {
                    $pName = preg_replace('/\s*-\s*' . preg_quote($cleanVp, '/') . '$/i', '', $pName);
                }
            }

            $varText = ! empty($varParts) ? implode(', ', $varParts) : '';
            $qty = (int) ($order->quantity ?: 1);

            if (! empty($varText)) {
                $items[] = "{$pName} | {$varText} | {$qty}";
            } else {
                $items[] = "{$pName} | {$qty}";
            }
        }

        // Join items consecutively with " | "
        return implode(' | ', $items);
    }

    /**
     * Format a clean invoice string strictly satisfying Steadfast's alpha_dash requirement:
     * Allowed characters: letters, numbers, dashes (-), and underscores (_).
     * Replaces ' | ' with '-', spaces with '_', strips forbidden punctuation, and appends unique order suffix.
     */
    public function formatSteadfastInvoice(Order $order, string $rawDescription): string
    {
        // 1. Replace item separator ' | ' with '-'
        $clean = str_replace(' | ', '-', $rawDescription);

        // 2. Remove punctuation that violates alpha_dash (colons, commas, slashes, brackets, quotes, etc.)
        $clean = str_replace([':', ';', ',', '(', ')', '[', ']', '{', '}', '/', '\\', '#', '@', '!', '?', '"', "'", '`'], '', $clean);

        // 3. Replace whitespace with '_'
        $clean = preg_replace('/\s+/', '_', $clean);

        // 4. Remove any remaining characters not in [A-Za-z0-9_-]
        $clean = preg_replace('/[^A-Za-z0-9_-]/', '', $clean);

        // 5. Deduplicate separators
        $clean = preg_replace('/-+/', '-', $clean);
        $clean = preg_replace('/_+/', '_', $clean);
        $clean = trim($clean, '-_');

        // 6. Ensure uniqueness with sanitized order number / order id
        $orderSuffix = preg_replace('/[^A-Za-z0-9_-]/', '', (string) $order->order_number);
        if (empty($orderSuffix)) {
            $orderSuffix = (string) $order->id;
        }

        if (! empty($clean)) {
            if (! str_contains($clean, $orderSuffix)) {
                if (mb_strlen($clean) + mb_strlen($orderSuffix) + 1 > 100) {
                    $clean = mb_substr($clean, 0, 99 - mb_strlen($orderSuffix));
                    $clean = trim($clean, '-_');
                }
                $clean .= '_' . $orderSuffix;
            }
        } else {
            $clean = 'ORD-' . $orderSuffix;
        }

        return mb_substr($clean, 0, 100);
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

        // Invoice string specified by user: "Product Name | Product Variation | Quantity" (and multiple items joined by |)
        $invoiceDescription = $this->formatInvoiceDescription($order);
        if (empty($invoiceDescription)) {
            $invoiceDescription = (string) $order->order_number;
        }

        $customerName = $order->customer?->name ?: 'Customer';

        // Steadfast delivery type: 0 = Home Delivery, 1 = Hub Pick Up
        $deliveryTypeInt = 0;
        if (in_array($settings->delivery_type, ['hub', 'point', '1', 1], true)) {
            $deliveryTypeInt = 1;
        }

        // Note with product details & customer note
        $noteContent = $invoiceDescription;
        if (! empty($order->notes)) {
            $noteContent .= " | Note: {$order->notes}";
        }

        // Generate alpha_dash compliant invoice string for Steadfast API: [A-Za-z0-9_-]
        $cleanInvoice = $this->formatSteadfastInvoice($order, $invoiceDescription);

        $payload = [
            'invoice' => $cleanInvoice,
            'recipient_name' => $customerName,
            'recipient_phone' => $phone,
            'recipient_address' => $order->customer_address,
            'cod_amount' => (float) $order->total_amount,
            'note' => $noteContent,
            'item_description' => mb_substr($invoiceDescription, 0, 250),
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

    /**
     * Check live delivery status for a specific order.
     */
    public function checkDeliveryStatus(Order $order): array
    {
        $settings = $this->getSettings();
        if (empty($settings->api_key) || empty($settings->secret_key)) {
            return [
                'success' => false,
                'message' => 'Steadfast API Key or Secret Key is not configured.',
            ];
        }

        $code = $order->tracking_code;
        $cid = $order->consignment_id;

        if (empty($code) && empty($cid)) {
            return [
                'success' => false,
                'message' => 'Order does not have a tracking code or consignment ID.',
            ];
        }

        try {
            $endpoint = ! empty($code)
                ? "{$this->baseUrl}/status_by_trackingcode/{$code}"
                : "{$this->baseUrl}/status_by_cid/{$cid}";

            $response = Http::timeout(10)->withHeaders([
                'Api-Key' => $settings->api_key,
                'Secret-Key' => $settings->secret_key,
                'Content-Type' => 'application/json',
            ])->get($endpoint);

            if ($response->successful()) {
                $data = $response->json();
                $deliveryStatus = $data['delivery_status'] ?? null;

                if ($deliveryStatus) {
                    $update = [
                        'courier_status' => $deliveryStatus,
                    ];

                    if (in_array($deliveryStatus, ['delivered', 'delivered_approval_pending'])) {
                        $update['order_status'] = 'delivered';
                    } elseif (in_array($deliveryStatus, ['cancelled', 'cancelled_approval_pending', 'cancelled_return_received'])) {
                        $update['order_status'] = 'returned';
                        if (! $order->returned_at) {
                            $update['returned_at'] = now();
                        }
                        if (empty($order->return_reason)) {
                            $update['return_reason'] = 'Steadfast Courier: Cancelled / Return';
                        }
                    }

                    $order->update($update);

                    return [
                        'success' => true,
                        'delivery_status' => $deliveryStatus,
                        'raw_response' => $data,
                        'message' => "Order #{$order->order_number} status updated to: {$deliveryStatus}",
                    ];
                }
            }

            return [
                'success' => false,
                'message' => 'Could not determine status from Steadfast.',
                'raw' => $response->body(),
            ];
        } catch (\Exception $e) {
            Log::error("Steadfast checkDeliveryStatus error: {$e->getMessage()}");

            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Bulk check and sync status for active/pending courier orders.
     */
    public function syncPendingOrdersStatus(int $limit = 50): array
    {
        $orders = Order::whereNotNull('tracking_code')
            ->whereNotIn('order_status', ['delivered', 'returned', 'cancelled'])
            ->orderByDesc('courier_sent_at')
            ->limit($limit)
            ->get();

        $updatedCount = 0;
        $results = [];

        foreach ($orders as $order) {
            $res = $this->checkDeliveryStatus($order);
            if ($res['success']) {
                $updatedCount++;
                $results[] = [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'status' => $res['delivery_status'],
                ];
            }
        }

        return [
            'total_checked' => count($orders),
            'updated_count' => $updatedCount,
            'details' => $results,
        ];
    }
}

