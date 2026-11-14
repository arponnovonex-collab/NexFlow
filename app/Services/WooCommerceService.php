<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\WooCommerceSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WooCommerceService
{
    /**
     * Get or create current WooCommerce store settings.
     */
    public function getSettings(): WooCommerceSetting
    {
        return WooCommerceSetting::firstOrCreate([], [
            'store_url' => '',
            'consumer_key' => '',
            'consumer_secret' => '',
            'is_enabled' => false,
            'auto_sync_orders' => true,
            'sync_status' => 'idle',
        ]);
    }

    /**
     * Test connection to WooCommerce store.
     */
    public function testConnection(string $storeUrl, string $consumerKey, string $consumerSecret): array
    {
        $cleanUrl = rtrim(trim($storeUrl), '/');
        if (! str_starts_with($cleanUrl, 'http://') && ! str_starts_with($cleanUrl, 'https://')) {
            $cleanUrl = 'https://' . $cleanUrl;
        }

        try {
            $endpoint = "{$cleanUrl}/wp-json/wc/v3/system_status";
            $res = Http::timeout(10)
                ->withBasicAuth($consumerKey, $consumerSecret)
                ->get($endpoint);

            if ($res->successful()) {
                $data = $res->json();
                return [
                    'success' => true,
                    'message' => 'Successfully connected to WooCommerce store!',
                    'store_name' => $data['environment']['site_title'] ?? 'WooCommerce Store',
                    'wc_version' => $data['environment']['version'] ?? 'N/A',
                    'currency' => $data['settings']['currency'] ?? 'BDT',
                ];
            }

            // Fallback try orders endpoint with query parameters
            $fallbackEndpoint = "{$cleanUrl}/wp-json/wc/v3/orders";
            $fallbackRes = Http::timeout(10)->get($fallbackEndpoint, [
                'consumer_key' => $consumerKey,
                'consumer_secret' => $consumerSecret,
                'per_page' => 1,
            ]);

            if ($fallbackRes->successful()) {
                return [
                    'success' => true,
                    'message' => 'Successfully connected to WooCommerce store orders API!',
                    'store_name' => 'WooCommerce Store',
                    'wc_version' => 'REST API v3',
                    'currency' => 'BDT',
                ];
            }

            $errMsg = $res->json('message') ?: ($fallbackRes->json('message') ?: "HTTP {$res->status()}: Connection failed");
            return [
                'success' => false,
                'message' => 'WooCommerce authentication failed: ' . $errMsg,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Could not connect to store URL: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Sync orders from WooCommerce store.
     */
    public function syncOrders(int $limitPages = 20): array
    {
        $settings = $this->getSettings();
        if (! $settings->is_enabled || empty($settings->store_url) || empty($settings->consumer_key)) {
            return [
                'success' => false,
                'message' => 'WooCommerce store is not configured or disabled.',
                'synced_count' => 0,
            ];
        }

        $cleanUrl = rtrim(trim($settings->store_url), '/');
        if (! str_starts_with($cleanUrl, 'http://') && ! str_starts_with($cleanUrl, 'https://')) {
            $cleanUrl = 'https://' . $cleanUrl;
        }

        $settings->update([
            'sync_status' => 'syncing',
            'last_error' => null,
        ]);

        $endpoint = "{$cleanUrl}/wp-json/wc/v3/orders";
        $page = 1;
        $perPage = 100;
        $totalSynced = 0;
        $hasMore = true;

        try {
            while ($hasMore && $page <= $limitPages) {
                $response = Http::timeout(35)
                    ->withBasicAuth($settings->consumer_key, $settings->consumer_secret)
                    ->get($endpoint, [
                        'per_page' => $perPage,
                        'page' => $page,
                        'orderby' => 'date',
                        'order' => 'desc',
                    ]);

                if (! $response->successful()) {
                    // Try query params fallback
                    $response = Http::timeout(35)->get($endpoint, [
                        'consumer_key' => $settings->consumer_key,
                        'consumer_secret' => $settings->consumer_secret,
                        'per_page' => $perPage,
                        'page' => $page,
                        'orderby' => 'date',
                        'order' => 'desc',
                    ]);
                }

                if (! $response->successful()) {
                    if ($page === 1) {
                        $err = $response->json('message') ?: "HTTP {$response->status()}: Failed to fetch orders.";
                        $settings->update([
                            'sync_status' => 'failed',
                            'last_error' => $err,
                        ]);

                        return [
                            'success' => false,
                            'message' => $err,
                            'synced_count' => 0,
                        ];
                    }
                    break;
                }

                $wcOrders = $response->json();
                if (empty($wcOrders) || ! is_array($wcOrders)) {
                    break;
                }

                foreach ($wcOrders as $wcOrder) {
                    $this->processWooCommerceOrder($wcOrder);
                    $totalSynced++;
                }

                $totalPages = (int) $response->header('X-WP-TotalPages', 1);
                if ($page >= $totalPages || count($wcOrders) < $perPage) {
                    $hasMore = false;
                } else {
                    $page++;
                }
            }

            $settings->update([
                'sync_status' => 'success',
                'last_synced_at' => now(),
                'last_error' => null,
            ]);

            return [
                'success' => true,
                'message' => "Successfully synced {$totalSynced} orders from WooCommerce website!",
                'synced_count' => $totalSynced,
            ];
        } catch (\Throwable $e) {
            Log::error('WooCommerce Order Sync Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            $settings->update([
                'sync_status' => 'failed',
                'last_error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Sync error: ' . $e->getMessage(),
                'synced_count' => $totalSynced,
            ];
        }
    }

    /**
     * Process and ingest a single WooCommerce order array into NexFlow Order & Customer.
     */
    public function processWooCommerceOrder(array $wcOrder): ?Order
    {
        $wcId = $wcOrder['id'] ?? null;
        if (! $wcId) {
            return null;
        }

        $orderNumber = '#' . ($wcOrder['number'] ?? $wcId);
        $billing = $wcOrder['billing'] ?? [];
        $shipping = $wcOrder['shipping'] ?? [];

        // Resolve Customer Name
        $firstName = trim($billing['first_name'] ?? ($shipping['first_name'] ?? ''));
        $lastName = trim($billing['last_name'] ?? ($shipping['last_name'] ?? ''));
        $customerName = trim("{$firstName} {$lastName}") ?: 'Website Customer';

        // Resolve Phone Number
        $rawPhone = $billing['phone'] ?? ($shipping['phone'] ?? '');
        $cleanPhone = preg_replace('/[^0-9+]/', '', (string) $rawPhone);
        if (empty($cleanPhone)) {
            $cleanPhone = 'WC-CUST-' . $wcId;
        }

        // Resolve Address
        $addr1 = trim($shipping['address_1'] ?? ($billing['address_1'] ?? ''));
        $addr2 = trim($shipping['address_2'] ?? ($billing['address_2'] ?? ''));
        $city = trim($shipping['city'] ?? ($billing['city'] ?? ''));
        $state = trim($shipping['state'] ?? ($billing['state'] ?? ''));
        $postcode = trim($shipping['postcode'] ?? ($billing['postcode'] ?? ''));
        $addressParts = array_filter([$addr1, $addr2, $city, $state, $postcode]);
        $customerAddress = implode(', ', $addressParts) ?: ($billing['city'] ?? 'Dhaka, Bangladesh');

        // Find or create Customer
        $customer = null;
        if (! str_starts_with($cleanPhone, 'WC-CUST-')) {
            $customer = Customer::where('phone', $cleanPhone)->first();
        }
        if (! $customer && ! empty($billing['email'])) {
            $customer = Customer::where('email', $billing['email'])->first();
        }

        if (! $customer) {
            $customer = Customer::create([
                'name' => $customerName,
                'phone' => $cleanPhone,
                'email' => $billing['email'] ?? null,
                'address' => $customerAddress,
            ]);
        } else {
            // Update customer address/email if empty
            $updates = [];
            if (empty($customer->address) && ! empty($customerAddress)) {
                $updates['address'] = $customerAddress;
            }
            if (empty($customer->email) && ! empty($billing['email'])) {
                $updates['email'] = $billing['email'];
            }
            if (! empty($updates)) {
                $customer->update($updates);
            }
        }

        // Parse line items
        $lineItems = [];
        $totalQuantity = 0;
        foreach ($wcOrder['line_items'] ?? [] as $li) {
            $qty = (int) ($li['quantity'] ?? 1);
            $totalQuantity += $qty;
            $lineItems[] = [
                'id' => $li['id'] ?? null,
                'product_id' => $li['product_id'] ?? null,
                'variation_id' => $li['variation_id'] ?? null,
                'name' => $li['name'] ?? 'Product',
                'quantity' => $qty,
                'price' => (float) ($li['price'] ?? 0),
                'total' => (float) ($li['total'] ?? 0),
                'sku' => $li['sku'] ?? '',
                'image_url' => $li['image']['src'] ?? null,
            ];
        }

        // Map WooCommerce order status to NexFlow status
        $wcStatus = strtolower($wcOrder['status'] ?? 'pending');
        $orderStatus = match ($wcStatus) {
            'pending', 'on-hold' => 'pending_confirmation',
            'processing' => 'processing',
            'completed' => 'delivered',
            'cancelled' => 'cancelled',
            'refunded' => 'returned',
            'failed' => 'cancelled',
            default => 'confirmed',
        };

        // Map Payment Status
        $paymentMethod = $wcOrder['payment_method'] ?? 'cod';
        $paymentMethodTitle = $wcOrder['payment_method_title'] ?? strtoupper($paymentMethod);
        $shippingMethodTitle = $wcOrder['shipping_lines'][0]['method_title'] ?? 'Standard Delivery';

        $paymentStatus = 'unpaid';
        if (! empty($wcOrder['date_paid']) || in_array($wcStatus, ['processing', 'completed']) && ! str_contains(strtolower($paymentMethod), 'cod')) {
            $paymentStatus = 'paid';
        } elseif ($wcStatus === 'refunded') {
            $paymentStatus = 'refunded';
        }

        $totalAmount = (float) ($wcOrder['total'] ?? 0);
        $deliveryCharge = (float) ($wcOrder['shipping_total'] ?? 0);
        $firstItemPrice = count($lineItems) > 0 ? $lineItems[0]['price'] : $totalAmount;

        return Order::updateOrCreate(
            ['wc_order_id' => $wcId],
            [
                'order_number' => $orderNumber,
                'customer_id' => $customer->id,
                'order_source' => 'woocommerce',
                'quantity' => $totalQuantity ?: 1,
                'unit_price' => $firstItemPrice,
                'delivery_charge' => $deliveryCharge,
                'total_amount' => $totalAmount,
                'order_status' => $orderStatus,
                'payment_status' => $paymentStatus,
                'payment_method_title' => $paymentMethodTitle,
                'shipping_method_title' => $shippingMethodTitle,
                'customer_address' => $customerAddress,
                'customer_phone' => $cleanPhone,
                'items_data' => $lineItems,
                'notes' => $wcOrder['customer_note'] ?? null,
                'wc_raw_data' => $wcOrder,
            ]
        );
    }

    /**
     * Push status update back to WooCommerce store.
     */
    public function updateOrderStatusInWooCommerce(int $wcOrderId, string $nexflowStatus): bool
    {
        $settings = $this->getSettings();
        if (! $settings->is_enabled || empty($settings->store_url)) {
            return false;
        }

        $wcStatus = match ($nexflowStatus) {
            'pending_confirmation' => 'on-hold',
            'confirmed', 'processing' => 'processing',
            'shipped' => 'processing',
            'delivered' => 'completed',
            'cancelled' => 'cancelled',
            'returned' => 'refunded',
            default => 'processing',
        };

        $cleanUrl = rtrim(trim($settings->store_url), '/');
        try {
            $res = Http::timeout(10)
                ->withBasicAuth($settings->consumer_key, $settings->consumer_secret)
                ->put("{$cleanUrl}/wp-json/wc/v3/orders/{$wcOrderId}", [
                    'status' => $wcStatus,
                ]);

            return $res->successful();
        } catch (\Throwable $e) {
            Log::error("Failed to update WC order #{$wcOrderId} status: " . $e->getMessage());
            return false;
        }
    }
}
