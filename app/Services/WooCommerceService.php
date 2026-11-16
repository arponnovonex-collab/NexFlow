<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductCategory;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\WooCommerceSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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
        $firstItemSize = null;
        $firstItemColor = null;
        $firstItemProductId = null;
        $firstItemVariantId = null;

        foreach ($wcOrder['line_items'] ?? [] as $li) {
            $qty = (int) ($li['quantity'] ?? 1);
            $totalQuantity += $qty;

            $itemSize = null;
            $itemColor = null;
            $itemVarParts = [];

            foreach ($li['meta_data'] ?? [] as $meta) {
                $key = strtolower($meta['key'] ?? $meta['display_key'] ?? '');
                $val = trim((string) ($meta['value'] ?? $meta['display_value'] ?? ''));
                if (empty($val) || is_array($val)) continue;

                if (str_contains($key, 'size') || str_contains($key, 'সাইজ')) {
                    $itemSize = $val;
                    $itemVarParts[] = 'Size: ' . $val;
                } elseif (str_contains($key, 'color') || str_contains($key, 'colour') || str_contains($key, 'কালার')) {
                    $itemColor = $val;
                    $itemVarParts[] = 'Color: ' . $val;
                }
            }

            if (! $firstItemSize && $itemSize) $firstItemSize = $itemSize;
            if (! $firstItemColor && $itemColor) $firstItemColor = $itemColor;
            if (! $firstItemProductId && ! empty($li['product_id'])) $firstItemProductId = $li['product_id'];
            if (! $firstItemVariantId && ! empty($li['variation_id'])) $firstItemVariantId = $li['variation_id'];

            $lineItems[] = [
                'id' => $li['id'] ?? null,
                'product_id' => $li['product_id'] ?? null,
                'variation_id' => $li['variation_id'] ?? null,
                'name' => $li['name'] ?? 'Product',
                'size' => $itemSize,
                'color' => $itemColor,
                'variation' => implode(', ', $itemVarParts),
                'quantity' => $qty,
                'price' => (float) ($li['price'] ?? 0),
                'total' => (float) ($li['total'] ?? 0),
                'sku' => $li['sku'] ?? '',
                'image_url' => $li['image']['src'] ?? null,
                'meta_data' => $li['meta_data'] ?? [],
            ];
        }

        // Match local product if available
        $localProduct = null;
        if ($firstItemProductId) {
            $localProduct = \App\Models\Product::where('wc_product_id', $firstItemProductId)->first();
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
                'product_id' => $localProduct?->id,
                'size' => $firstItemSize,
                'color' => $firstItemColor,
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
     * Sync products from WooCommerce store.
     */
    public function syncProducts(int $limitPages = 15): array
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

        $endpoint = "{$cleanUrl}/wp-json/wc/v3/products";
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
                        'status' => 'publish',
                    ]);

                if (! $response->successful()) {
                    // Try query params fallback
                    $response = Http::timeout(35)->get($endpoint, [
                        'consumer_key' => $settings->consumer_key,
                        'consumer_secret' => $settings->consumer_secret,
                        'per_page' => $perPage,
                        'page' => $page,
                        'status' => 'publish',
                    ]);
                }

                if (! $response->successful()) {
                    if ($page === 1) {
                        $err = $response->json('message') ?: "HTTP {$response->status()}: Failed to fetch products from WooCommerce.";
                        return [
                            'success' => false,
                            'message' => $err,
                            'synced_count' => 0,
                        ];
                    }
                    break;
                }

                $wcProducts = $response->json();
                if (empty($wcProducts) || ! is_array($wcProducts)) {
                    break;
                }

                foreach ($wcProducts as $wcProd) {
                    try {
                        $this->processWooCommerceProduct($wcProd, $cleanUrl, $settings);
                        $totalSynced++;
                    } catch (\Throwable $ex) {
                        Log::error("Failed to sync WC Product #{$wcProd['id']}: " . $ex->getMessage());
                    }
                }

                if (count($wcProducts) < $perPage) {
                    $hasMore = false;
                } else {
                    $page++;
                }
            }

            return [
                'success' => true,
                'message' => "Successfully synced {$totalSynced} products from WooCommerce store!",
                'synced_count' => $totalSynced,
            ];
        } catch (\Throwable $e) {
            Log::error('WooCommerce Product Sync Exception: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Sync failed: ' . $e->getMessage(),
                'synced_count' => $totalSynced,
            ];
        }
    }

    /**
     * Process and upsert a single WooCommerce product into NexFlow.
     */
    public function processWooCommerceProduct(array $wcProd, string $cleanUrl, WooCommerceSetting $settings): ?Product
    {
        $wcProductId = (int) ($wcProd['id'] ?? 0);
        if (! $wcProductId) {
            return null;
        }

        $name = trim(html_entity_decode($wcProd['name'] ?? 'Product'));
        $sku = ! empty($wcProd['sku']) ? trim($wcProd['sku']) : ('WC-' . $wcProductId);
        $regularPrice = (float) ($wcProd['regular_price'] ?: ($wcProd['price'] ?: 0));
        $sellingPrice = (float) ($wcProd['sale_price'] ?: ($wcProd['price'] ?: $regularPrice));
        $shortDesc = trim(strip_tags(html_entity_decode($wcProd['short_description'] ?? '')));
        $fullDesc = $wcProd['description'] ?? null;
        $availability = ($wcProd['stock_status'] ?? 'instock') === 'outofstock' ? 'out_of_stock' : 'in_stock';
        $productUrl = $wcProd['permalink'] ?? null;

        // 1. Category
        $categoryId = null;
        if (! empty($wcProd['categories']) && is_array($wcProd['categories'])) {
            $catName = trim(html_entity_decode($wcProd['categories'][0]['name'] ?? ''));
            if (! empty($catName)) {
                $catSlug = Str::slug($catName);
                $category = ProductCategory::firstOrCreate(
                    ['slug' => $catSlug],
                    ['name' => $catName, 'is_active' => true]
                );
                $categoryId = $category->id;
            }
        }

        // 2. Attributes sync into product_attributes & product_attribute_values
        $productAttributes = [];
        if (! empty($wcProd['attributes']) && is_array($wcProd['attributes'])) {
            foreach ($wcProd['attributes'] as $attr) {
                $attrName = trim($attr['name'] ?? '');
                $options = $attr['options'] ?? [];
                if (empty($attrName) || empty($options)) {
                    continue;
                }

                $attrSlug = Str::slug($attrName);
                $isColor = str_contains(strtolower($attrName), 'color') || str_contains(strtolower($attrName), 'colour');
                $type = $isColor ? 'color' : 'button';

                $dbAttr = ProductAttribute::firstOrCreate(
                    ['slug' => $attrSlug],
                    ['name' => $attrName, 'type' => $type, 'sort_order' => 1]
                );

                foreach ($options as $optIdx => $opt) {
                    $optName = trim($opt);
                    if ($optName !== '') {
                        ProductAttributeValue::firstOrCreate(
                            ['attribute_id' => $dbAttr->id, 'name' => $optName],
                            ['value' => $optName, 'sort_order' => $optIdx + 1]
                        );
                    }
                }

                $productAttributes[] = [
                    'id' => $dbAttr->id,
                    'name' => $attrName,
                    'options' => $options,
                ];
            }
        }

        // 3. Find or create Product
        $product = Product::where('wc_product_id', $wcProductId)->first();
        if (! $product && ! empty($sku)) {
            $product = Product::where('sku', $sku)->first();
        }

        if (! $product) {
            $slug = Str::slug($name) . '-' . Str::random(4);
            $product = Product::create([
                'wc_product_id' => $wcProductId,
                'category_id' => $categoryId,
                'name' => $name,
                'sku' => $sku,
                'slug' => $slug,
                'short_description' => $shortDesc,
                'full_description' => $fullDesc,
                'regular_price' => $regularPrice,
                'selling_price' => $sellingPrice,
                'availability' => $availability,
                'product_url' => $productUrl,
                'attributes' => $productAttributes,
                'is_active' => true,
            ]);
        } else {
            $product->update([
                'wc_product_id' => $wcProductId,
                'category_id' => $categoryId ?: $product->category_id,
                'name' => $name,
                'regular_price' => $regularPrice,
                'selling_price' => $sellingPrice,
                'short_description' => $shortDesc ?: $product->short_description,
                'full_description' => $fullDesc ?: $product->full_description,
                'availability' => $availability,
                'product_url' => $productUrl ?: $product->product_url,
                'attributes' => ! empty($productAttributes) ? $productAttributes : $product->attributes,
                'is_active' => true,
            ]);
        }

        // 4. Images
        if (! empty($wcProd['images']) && is_array($wcProd['images'])) {
            $product->images()->delete();
            foreach ($wcProd['images'] as $idx => $img) {
                if (! empty($img['src'])) {
                    ProductImage::create([
                        'product_id' => $product->id,
                        'image_url' => $img['src'],
                        'is_primary' => $idx === 0,
                        'sort_order' => $idx,
                    ]);
                }
            }
        }

        // 5. Variations
        $isVariable = ($wcProd['type'] ?? '') === 'variable' && ! empty($wcProd['variations']);
        $syncedVariants = false;

        if ($isVariable) {
            try {
                $varEndpoint = "{$cleanUrl}/wp-json/wc/v3/products/{$wcProductId}/variations";
                $varRes = Http::timeout(20)
                    ->withBasicAuth($settings->consumer_key, $settings->consumer_secret)
                    ->get($varEndpoint, ['per_page' => 100]);

                if (! $varRes->successful()) {
                    $varRes = Http::timeout(20)->get($varEndpoint, [
                        'consumer_key' => $settings->consumer_key,
                        'consumer_secret' => $settings->consumer_secret,
                        'per_page' => 100,
                    ]);
                }

                if ($varRes->successful()) {
                    $variations = $varRes->json();
                    if (is_array($variations) && count($variations) > 0) {
                        $product->variants()->delete();
                        foreach ($variations as $var) {
                            $varSku = ! empty($var['sku']) ? $var['sku'] : ($product->sku . '-VAR-' . $var['id']);
                            $varPrice = (float) ($var['sale_price'] ?: ($var['price'] ?: ($var['regular_price'] ?: $product->selling_price)));
                            $varStock = isset($var['stock_quantity']) && is_numeric($var['stock_quantity']) ? (int) $var['stock_quantity'] : 10;

                            $size = null;
                            $color = null;
                            if (! empty($var['attributes']) && is_array($var['attributes'])) {
                                foreach ($var['attributes'] as $attr) {
                                    $attrNameLower = strtolower($attr['name'] ?? '');
                                    $attrVal = $attr['option'] ?? '';
                                    if (str_contains($attrNameLower, 'size') || str_contains($attrNameLower, 'সাইজ')) {
                                        $size = $attrVal;
                                    } elseif (str_contains($attrNameLower, 'color') || str_contains($attrNameLower, 'colour') || str_contains($attrNameLower, 'কালার')) {
                                        $color = $attrVal;
                                    } elseif (! $size) {
                                        $size = $attrVal;
                                    }
                                }
                            }

                            ProductVariant::create([
                                'product_id' => $product->id,
                                'size' => $size,
                                'color' => $color,
                                'sku' => $varSku,
                                'price' => $varPrice,
                                'stock' => $varStock,
                                'is_active' => true,
                            ]);
                        }
                        $syncedVariants = true;
                    }
                }
            } catch (\Throwable $ve) {
                Log::warning("Could not fetch variations for WC product #{$wcProductId}: " . $ve->getMessage());
            }
        }

        // Fallback: If no variations synced from API but product has attributes
        if (! $syncedVariants && ! empty($productAttributes)) {
            $sizes = [];
            $colors = [];
            foreach ($productAttributes as $pa) {
                $paLower = strtolower($pa['name'] ?? '');
                if (str_contains($paLower, 'size') || str_contains($paLower, 'সাইজ')) {
                    $sizes = $pa['options'] ?? [];
                } elseif (str_contains($paLower, 'color') || str_contains($paLower, 'colour') || str_contains($paLower, 'কালার')) {
                    $colors = $pa['options'] ?? [];
                }
            }

            if (! empty($sizes) || ! empty($colors)) {
                $product->variants()->delete();
                if (! empty($sizes) && ! empty($colors)) {
                    foreach ($sizes as $s) {
                        foreach ($colors as $c) {
                            ProductVariant::create([
                                'product_id' => $product->id,
                                'size' => $s,
                                'color' => $c,
                                'sku' => $product->sku . '-' . Str::slug($s) . '-' . Str::slug($c),
                                'price' => $product->selling_price,
                                'stock' => 10,
                                'is_active' => true,
                            ]);
                        }
                    }
                } elseif (! empty($sizes)) {
                    foreach ($sizes as $s) {
                        ProductVariant::create([
                            'product_id' => $product->id,
                            'size' => $s,
                            'color' => null,
                            'sku' => $product->sku . '-' . Str::slug($s),
                            'price' => $product->selling_price,
                            'stock' => 10,
                            'is_active' => true,
                        ]);
                    }
                } elseif (! empty($colors)) {
                    foreach ($colors as $c) {
                        ProductVariant::create([
                            'product_id' => $product->id,
                            'size' => null,
                            'color' => $c,
                            'sku' => $product->sku . '-' . Str::slug($c),
                            'price' => $product->selling_price,
                            'stock' => 10,
                            'is_active' => true,
                        ]);
                    }
                }
            }
        }

        return $product;
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
