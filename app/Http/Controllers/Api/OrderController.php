<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\LeadStatusHistory;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Services\BulkSmsService;
use App\Services\SteadfastCourierService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    /**
     * List all orders.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['customer', 'product', 'variant', 'user:id,name']);

        if ($request->filled('order_status')) {
            $query->where('order_status', $request->order_status);
        }

        if ($request->filled('source')) {
            $source = $request->source;
            if ($source === 'engagement') {
                $query->where(function ($sq) {
                    $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                        ->orWhereNull('order_source')
                        ->orWhere('order_source', '!=', 'woocommerce');
                });
            } elseif ($source === 'website') {
                $query->whereIn('order_source', ['woocommerce', 'web']);
            }
        }

        if ($request->filled('search')) {
            $rawSearch = trim($request->search);
            $cleanDigits = preg_replace('/[^0-9]/', '', $rawSearch);
            $cleanNum = ltrim($rawSearch, '#');

            $query->where(function ($q) use ($rawSearch, $cleanDigits, $cleanNum) {
                // 1. Order number or WooCommerce ID match
                $q->where('order_number', 'like', "%{$rawSearch}%")
                    ->orWhere('order_number', 'like', "%{$cleanNum}%");

                if (! empty($cleanNum) && is_numeric($cleanNum)) {
                    $q->orWhere('wc_order_id', (int) $cleanNum);
                }

                // 2. Customer phone number match (with or without +880, 018...)
                $q->orWhere('customer_phone', 'like', "%{$rawSearch}%");
                if (! empty($cleanDigits)) {
                    $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                    $q->orWhere('customer_phone', 'like', "%{$cleanDigits}%")
                        ->orWhere('customer_phone', 'like', "%{$lastDigits}%");
                }

                // 3. Customer address & email match
                $q->orWhere('customer_address', 'like', "%{$rawSearch}%")
                    ->orWhere('customer_email', 'like', "%{$rawSearch}%")
                    ->orWhere('size', 'like', "%{$rawSearch}%")
                    ->orWhere('color', 'like', "%{$rawSearch}%");

                // 4. Linked Customer relation match (name or phone)
                $q->orWhereHas('customer', function ($cq) use ($rawSearch, $cleanDigits) {
                    $cq->where('name', 'like', "%{$rawSearch}%")
                        ->orWhere('phone', 'like', "%{$rawSearch}%");
                    if (! empty($cleanDigits)) {
                        $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                        $cq->orWhere('phone', 'like', "%{$cleanDigits}%")
                            ->orWhere('phone', 'like', "%{$lastDigits}%");
                    }
                });
            });
        }

        $perPage = $request->integer('per_page', 50);
        if ($perPage > 250) {
            $perPage = 250;
        }

        // For website / WooCommerce orders, strictly sequence by WooCommerce Order ID (wc_order_id DESC)
        // so that the order sequence perfectly matches the WooCommerce store admin.
        if ($request->query('source') === 'website') {
            $query->orderByDesc('wc_order_id')->orderByDesc('created_at');
        } else {
            $query->orderByDesc('created_at')->orderByDesc('id');
        }

        $orders = $query->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $orders,
        ]);
    }

    /**
     * Create an order from conversation or directly.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'customer_name' => 'nullable|string|max:255',
            'customer_email' => 'nullable|string|email|max:255',
            'conversation_id' => 'nullable|exists:conversations,id',
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'size' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:50',
            'order_attributes' => 'nullable|array',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'required|numeric|min:0',
            'delivery_charge' => 'required|numeric|min:0',
            'customer_address' => 'required|string',
            'customer_phone' => 'required|string',
            'notes' => 'nullable|string',
            'order_number' => 'nullable|string|max:50',
        ]);

        $user = $request->user();
        $total = ($validated['unit_price'] * $validated['quantity']) + $validated['delivery_charge'];

        // Determine or create customer
        $customerId = $validated['customer_id'] ?? null;
        $customerEmail = ! empty($validated['customer_email']) ? trim($validated['customer_email']) : null;

        if (! $customerId) {
            $customer = Customer::firstOrCreate(
                ['phone' => $validated['customer_phone']],
                [
                    'name' => $validated['customer_name'] ?? 'Customer',
                    'email' => $customerEmail,
                ]
            );
            $customerId = $customer->id;
            if ($customerEmail && empty($customer->email)) {
                $customer->update(['email' => $customerEmail]);
            }
        } else {
            // Update customer phone / email if provided
            $custUpdates = ['phone' => $validated['customer_phone']];
            if ($customerEmail) {
                $custUpdates['email'] = $customerEmail;
            }
            Customer::where('id', $customerId)->update($custUpdates);
            if (! empty($validated['customer_name'])) {
                Customer::where('id', $customerId)
                    ->where(function ($q) {
                        $q->where('name', 'like', 'Facebook%')
                            ->orWhere('name', 'like', 'Customer%')
                            ->orWhereNull('name');
                    })
                    ->update([
                        'name' => $validated['customer_name'],
                    ]);
                \App\Models\CustomerChannelIdentity::where('customer_id', $customerId)
                    ->where(function ($q) {
                        $q->where('profile_name', 'like', 'Facebook%')
                            ->orWhere('profile_name', 'like', 'Customer%')
                            ->orWhereNull('profile_name');
                    })
                    ->update([
                        'profile_name' => $validated['customer_name'],
                    ]);
            }
        }

        // Determine size & color
        $size = $validated['size'] ?? null;
        $color = $validated['color'] ?? null;
        if (! empty($validated['variant_id'])) {
            $variant = \App\Models\ProductVariant::find($validated['variant_id']);
            if ($variant) {
                $size = $size ?: $variant->size;
                $color = $color ?: $variant->color;
            }
        }

        // Custom order number or generate auto ID
        $orderNumber = ! empty($validated['order_number'])
            ? trim($validated['order_number'])
            : 'NF-' . date('ymd') . '-' . rand(1000, 9999);

        // Ensure order number uniqueness
        if (Order::where('order_number', $orderNumber)->exists()) {
            $orderNumber .= '-' . strtoupper(Str::random(3));
        }

        $orderData = [
            'order_number' => $orderNumber,
            'customer_id' => $customerId,
            'conversation_id' => $validated['conversation_id'] ?? null,
            'user_id' => $user->id,
            'product_id' => $validated['product_id'],
            'variant_id' => $validated['variant_id'] ?? null,
            'size' => $size,
            'color' => $color,
            'order_attributes' => $validated['order_attributes'] ?? null,
            'quantity' => $validated['quantity'],
            'unit_price' => $validated['unit_price'],
            'delivery_charge' => $validated['delivery_charge'],
            'total_amount' => $total,
            'order_status' => 'confirmed',
            'payment_status' => 'unpaid',
            'order_source' => ! empty($validated['conversation_id']) ? 'manual_inbox' : 'web',
            'customer_address' => $validated['customer_address'],
            'customer_phone' => $validated['customer_phone'],
            'customer_email' => $customerEmail,
            'notes' => $validated['notes'] ?? null,
        ];

        $order = DB::transaction(function () use ($orderData, $user, $customerId) {
            $ord = Order::create($orderData);

            // Transition lead to converted if lead exists
            $lead = Lead::where('customer_id', $customerId)->first();
            if ($lead && $lead->status !== 'converted') {
                $prev = $lead->status;
                $lead->update([
                    'status' => 'converted',
                    'last_status_change_at' => now(),
                ]);

                LeadStatusHistory::create([
                    'lead_id' => $lead->id,
                    'previous_status' => $prev,
                    'new_status' => 'converted',
                    'changed_by_user_id' => $user->id,
                    'source' => 'system',
                    'reason' => 'Verified order created: ' . $ord->order_number,
                ]);
            }

            return $ord;
        });

        // Trigger Auto-SMS to Customer via BulkSMS BD if enabled
        $smsResult = app(BulkSmsService::class)->sendAutoOrderSms($order);

        // Post internal note in conversation thread if linked
        if ($order->conversation_id) {
            try {
                $variantInfo = $order->variant ? " (" . ($order->variant->size ? "Size: {$order->variant->size} " : "") . ($order->variant->color ? "Color: {$order->variant->color}" : "") . ")" : "";
                Message::create([
                    'conversation_id' => $order->conversation_id,
                    'sender_type' => 'moderator',
                    'sender_user_id' => $user->id,
                    'is_internal_note' => true,
                    'text' => "🛍️ Order #{$order->order_number} confirmed! Product: {$order->product?->name}{$variantInfo}, Qty: {$order->quantity}, Total: ৳{$order->total_amount}. Phone: {$order->customer_phone}",
                    'metadata' => [
                        'order_id' => $order->id,
                        'order_number' => $order->order_number,
                        'auto_sms' => $smsResult,
                    ],
                ]);
            } catch (\Exception $e) {
                // Silently continue
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Order #{$order->order_number} created successfully!",
            'data' => $order->load(['customer', 'product', 'variant']),
            'auto_sms' => $smsResult,
        ], 201);
    }

    /**
     * Update order status.
     */
    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'order_status' => 'required|in:draft,pending_confirmation,confirmed,processing,shipped,delivered,cancelled,returned',
            'payment_status' => 'nullable|in:unpaid,paid,refunded',
        ]);

        $order->update($validated);

        // If order came from WooCommerce, sync status back to store
        if ($order->wc_order_id && ! empty($validated['order_status'])) {
            try {
                app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                    (int) $order->wc_order_id,
                    $validated['order_status']
                );
            } catch (\Throwable $e) {
                // Silently continue
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Order status updated successfully',
            'data' => $order,
        ]);
    }

    /**
     * Edit / Update an existing order (Customer details, product attributes, size, color, quantity, pricing).
     */
    public function update(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => 'nullable|integer|min:1',
            'size' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:50',
            'unit_price' => 'nullable|numeric|min:0',
            'delivery_charge' => 'nullable|numeric|min:0',
            'total_amount' => 'nullable|numeric|min:0',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'customer_address' => 'nullable|string',
            'customer_email' => 'nullable|string|email|max:255',
            'order_status' => 'nullable|string|in:draft,pending_confirmation,confirmed,processing,shipped,delivered,cancelled,returned',
            'notes' => 'nullable|string',
        ]);

        $qty = $validated['quantity'] ?? $order->quantity;
        $unitPrice = $validated['unit_price'] ?? $order->unit_price;
        $delivery = $validated['delivery_charge'] ?? $order->delivery_charge;

        if (! isset($validated['total_amount']) && (isset($validated['quantity']) || isset($validated['unit_price']) || isset($validated['delivery_charge']))) {
            $validated['total_amount'] = ($qty * $unitPrice) + $delivery;
        }

        if (! empty($validated['customer_name']) && $order->customer) {
            $order->customer->update(['name' => $validated['customer_name']]);
        }

        $order->update($validated);

        if ($order->wc_order_id && ! empty($validated['order_status'])) {
            try {
                app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                    (int) $order->wc_order_id,
                    $validated['order_status']
                );
            } catch (\Throwable $e) {}
        }

        return response()->json([
            'status' => 'success',
            'message' => "Order #{$order->order_number} updated successfully!",
            'data' => $order->fresh(['customer', 'product', 'variant']),
        ]);
    }

    /**
     * CX Operations: Order Verification Desk for Duplicates & Multi-Quantity Orders.
     */
    public function cxOperations(Request $request): JsonResponse
    {
        $days = $request->integer('days', 10);
        $tab = $request->query('tab', 'all');
        $search = trim((string) $request->query('search', ''));

        $startDate = Carbon::now()->subDays($days)->startOfDay();

        $rawOrders = Order::with(['customer', 'product', 'variant', 'user:id,name'])
            ->where('created_at', '>=', $startDate)
            ->orderByDesc('created_at')
            ->get();

        $normalizePhone = function (?string $phone): string {
            if (empty($phone)) return '';
            $digits = preg_replace('/[^0-9]/', '', $phone);
            if (str_starts_with($digits, '880') && strlen($digits) === 13) {
                $digits = substr($digits, 2);
            }
            if (strlen($digits) === 10 && str_starts_with($digits, '1')) {
                $digits = '0' . $digits;
            }
            return $digits;
        };

        // Attach normalized phone and resolution status to each order
        foreach ($rawOrders as $order) {
            $order->normalized_phone = $normalizePhone($order->customer_phone ?: $order->customer?->phone);
            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $order->is_cx_resolved = ! empty($raw['is_cx_resolved']) 
                || str_contains((string) $order->notes, '[CX Resolved') 
                || str_contains((string) $order->notes, '[CX Review: Quantity adjusted');
        }

        // Group orders by normalized phone + product
        $phoneProductGroups = [];
        foreach ($rawOrders as $ord) {
            $norm = $ord->normalized_phone;
            if (empty($norm)) continue;

            $prodKey = $ord->product_id ? 'pid_' . $ord->product_id : 'pname_' . Str::slug($ord->product?->name ?: ($ord->items_data[0]['name'] ?? 'product'));
            $groupKey = $norm . '__' . $prodKey;

            if (! isset($phoneProductGroups[$groupKey])) {
                $phoneProductGroups[$groupKey] = [];
            }
            $phoneProductGroups[$groupKey][] = $ord;
        }

        $duplicateOrderIds = [];
        $duplicateGroups = [];
        $groupIndex = 1;

        foreach ($phoneProductGroups as $groupKey => $groupList) {
            // If there are 2 or more orders for this customer and product in the window
            if (count($groupList) >= 2) {
                foreach ($groupList as $ord) {
                    $duplicateOrderIds[$ord->id] = true;
                }

                $unresolvedActiveCount = 0;
                $activeCount = 0;
                $cancelledCount = 0;

                foreach ($groupList as $ord) {
                    if ($ord->order_status === 'cancelled') {
                        $cancelledCount++;
                    } else {
                        $activeCount++;
                        if (! $ord->is_cx_resolved) {
                            $unresolvedActiveCount++;
                        }
                    }
                }

                // Group is resolved when no unresolved active orders remain
                $isGroupResolved = ($unresolvedActiveCount === 0);

                $firstOrder = $groupList[0];
                $duplicateGroups[] = [
                    'group_id' => 'dup_grp_' . $groupIndex++,
                    'group_key' => $groupKey,
                    'customer_name' => $firstOrder->customer?->name ?: 'Customer',
                    'customer_phone' => $firstOrder->customer_phone ?: $firstOrder->customer?->phone ?: '',
                    'normalized_phone' => $firstOrder->normalized_phone,
                    'customer_address' => $firstOrder->customer_address ?: '',
                    'product_name' => $firstOrder->product?->name ?: ($firstOrder->items_data[0]['name'] ?? 'Product'),
                    'product_image' => $firstOrder->product?->primary_image_url ?: null,
                    'order_count' => count($groupList),
                    'active_order_count' => $activeCount,
                    'cancelled_order_count' => $cancelledCount,
                    'unresolved_order_count' => $unresolvedActiveCount,
                    'is_resolved' => $isGroupResolved,
                    'orders' => array_values($groupList),
                ];
            }
        }

        // Standalone multi-quantity orders (not part of duplicate groups)
        $standaloneMultiQtyOrders = [];
        foreach ($rawOrders as $order) {
            if (isset($duplicateOrderIds[$order->id])) {
                continue;
            }

            $isMultiQty = ($order->quantity > 1);
            if (! $isMultiQty && is_array($order->items_data) && ! empty($order->items_data)) {
                foreach ($order->items_data as $item) {
                    if (($item['quantity'] ?? 1) > 1) {
                        $isMultiQty = true;
                        break;
                    }
                }
            }

            if ($isMultiQty) {
                $order->is_multi_qty = true;
                $standaloneMultiQtyOrders[] = $order;
            }
        }

        // Search matcher
        $matchesSearch = function ($text) use ($search) {
            if (empty($search)) return true;
            return str_contains(strtolower((string) $text), strtolower($search));
        };

        // Filter duplicate groups based on tab and search
        $filteredGroups = [];
        foreach ($duplicateGroups as $grp) {
            if (! empty($search)) {
                $searchMatched = $matchesSearch($grp['customer_name'])
                    || $matchesSearch($grp['customer_phone'])
                    || $matchesSearch($grp['normalized_phone'])
                    || $matchesSearch($grp['product_name']);

                if (! $searchMatched) {
                    foreach ($grp['orders'] as $ord) {
                        if ($matchesSearch($ord->order_number) || $matchesSearch($ord->wc_order_id) || $matchesSearch($ord->customer_address)) {
                            $searchMatched = true;
                            break;
                        }
                    }
                }

                if (! $searchMatched) continue;
            }

            if ($tab === 'duplicates') {
                if (! $grp['is_resolved']) {
                    $filteredGroups[] = $grp;
                }
            } elseif ($tab === 'resolved') {
                if ($grp['is_resolved']) {
                    $filteredGroups[] = $grp;
                }
            } elseif ($tab === 'all') {
                if (! $grp['is_resolved']) {
                    $filteredGroups[] = $grp;
                }
            }
        }

        // Filter standalone multi-quantity orders
        $filteredMultiQty = [];
        foreach ($standaloneMultiQtyOrders as $ord) {
            if (! empty($search)) {
                $searchMatched = $matchesSearch($ord->customer?->name)
                    || $matchesSearch($ord->customer_phone)
                    || $matchesSearch($ord->normalized_phone)
                    || $matchesSearch($ord->order_number)
                    || $matchesSearch($ord->wc_order_id)
                    || $matchesSearch($ord->product?->name);
                if (! $searchMatched) continue;
            }

            if ($tab === 'multi_qty') {
                if (! $ord->is_cx_resolved && $ord->order_status !== 'cancelled') {
                    $filteredMultiQty[] = $ord;
                }
            } elseif ($tab === 'resolved') {
                if ($ord->is_cx_resolved) {
                    $filteredMultiQty[] = $ord;
                }
            } elseif ($tab === 'all') {
                if (! $ord->is_cx_resolved && $ord->order_status !== 'cancelled') {
                    $filteredMultiQty[] = $ord;
                }
            }
        }

        // Cancelled orders
        $cancelledOrders = [];
        if ($tab === 'cancelled') {
            foreach ($rawOrders as $ord) {
                if ($ord->order_status === 'cancelled') {
                    if (! empty($search)) {
                        $searchMatched = $matchesSearch($ord->customer?->name)
                            || $matchesSearch($ord->customer_phone)
                            || $matchesSearch($ord->normalized_phone)
                            || $matchesSearch($ord->order_number)
                            || $matchesSearch($ord->product?->name);
                        if (! $searchMatched) continue;
                    }
                    $cancelledOrders[] = $ord;
                }
            }
        }

        // Additional resolved orders
        $otherResolvedOrders = [];
        if ($tab === 'resolved') {
            $existingIds = [];
            foreach ($filteredGroups as $g) {
                foreach ($g['orders'] as $o) {
                    $existingIds[$o->id] = true;
                }
            }
            foreach ($filteredMultiQty as $o) {
                $existingIds[$o->id] = true;
            }

            foreach ($rawOrders as $ord) {
                if ($ord->is_cx_resolved && ! isset($existingIds[$ord->id])) {
                    if (! empty($search)) {
                        $searchMatched = $matchesSearch($ord->customer?->name)
                            || $matchesSearch($ord->customer_phone)
                            || $matchesSearch($ord->normalized_phone)
                            || $matchesSearch($ord->order_number)
                            || $matchesSearch($ord->product?->name);
                        if (! $searchMatched) continue;
                    }
                    $otherResolvedOrders[] = $ord;
                }
            }
        }

        $pendingDuplicateGroupsCount = count(array_filter($duplicateGroups, fn($g) => ! $g['is_resolved']));
        $pendingMultiQtyCount = count(array_filter($standaloneMultiQtyOrders, fn($o) => ! $o->is_cx_resolved && $o->order_status !== 'cancelled'));
        $totalReviewNeeded = $pendingDuplicateGroupsCount + $pendingMultiQtyCount;

        $resolvedTotalCount = count(array_filter($rawOrders->toArray(), fn($o) => ! empty($o['wc_raw_data']['is_cx_resolved']) || str_contains((string) ($o['notes'] ?? ''), '[CX Resolved') || str_contains((string) ($o['notes'] ?? ''), '[CX Review: Quantity adjusted')));
        $cancelledTotalCount = count(array_filter($rawOrders->toArray(), fn($o) => $o['order_status'] === 'cancelled'));

        return response()->json([
            'status' => 'success',
            'data' => [
                'duplicate_groups' => array_values($filteredGroups),
                'multi_qty_orders' => array_values($filteredMultiQty),
                'cancelled_orders' => array_values($cancelledOrders),
                'other_resolved_orders' => array_values($otherResolvedOrders),
            ],
            'meta' => [
                'total_review_needed' => $totalReviewNeeded,
                'duplicate_groups_count' => $pendingDuplicateGroupsCount,
                'multi_qty_count' => $pendingMultiQtyCount,
                'resolved_count' => $resolvedTotalCount,
                'cancelled_count' => $cancelledTotalCount,
                'days' => $days,
            ],
        ]);
    }

    /**
     * Resolve or Reopen an entire Duplicate Group Problem.
     */
    public function cxResolveGroup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
            'reopen' => 'nullable|boolean',
            'note' => 'nullable|string',
        ]);

        $orderIds = $validated['order_ids'];
        $isReopen = ! empty($validated['reopen']);
        $user = $request->user();
        $userName = $user ? $user->name : 'CX Agent';
        $timeStr = now()->format('d M H:i');

        $orders = Order::whereIn('id', $orderIds)->get();

        foreach ($orders as $order) {
            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];

            if ($isReopen) {
                $raw['is_cx_resolved'] = false;
                $raw['cx_reopened_at'] = now()->toISOString();
                $raw['cx_reopened_by'] = $userName;

                $cxNote = "[CX Problem Reopened by {$userName} on {$timeStr}]";
                $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

                $order->update([
                    'notes' => $updatedNotes,
                    'wc_raw_data' => $raw,
                ]);
            } else {
                $raw['is_cx_resolved'] = true;
                $raw['cx_resolved_at'] = now()->toISOString();
                $raw['cx_resolved_by'] = $userName;

                $cxNote = "[CX Problem Resolved by {$userName} on {$timeStr}]";
                $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

                $updateData = [
                    'notes' => $updatedNotes,
                    'wc_raw_data' => $raw,
                ];

                if ($order->order_status !== 'cancelled') {
                    $updateData['order_status'] = 'confirmed';

                    if ($order->wc_order_id) {
                        try {
                            app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                                (int) $order->wc_order_id,
                                'processing'
                            );
                        } catch (\Throwable $e) {}
                    }
                }

                $order->update($updateData);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => $isReopen ? 'সমস্যাটি পুনরায় পেন্ডিং করা হয়েছে।' : 'সম্পূর্ণ ডুপ্লিকেট সমস্যাটি সফলভাবে সমাধান (Resolved) করা হয়েছে!',
        ]);
    }

    /**
     * Perform quick CX action (Resolve, Cancel, Set Qty to 1, or Confirm).
     */
    public function cxAction(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:resolve,confirm,cancel,set_qty_one',
            'reason' => 'nullable|string|max:255',
            'note' => 'nullable|string',
        ]);

        $action = $validated['action'];
        $user = $request->user();
        $userName = $user ? $user->name : 'CX Agent';
        $timeStr = now()->format('d M H:i');

        if ($action === 'resolve') {
            $cxNote = "[CX Resolved & Approved by {$userName} on {$timeStr}]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['is_cx_resolved'] = true;
            $raw['cx_resolved_at'] = now()->toISOString();
            $raw['cx_resolved_by'] = $userName;

            $updateData = [
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
            ];

            if ($order->order_status !== 'cancelled') {
                $updateData['order_status'] = 'confirmed';
            }

            $order->update($updateData);

            if ($order->wc_order_id && $order->order_status !== 'cancelled') {
                try {
                    app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                        (int) $order->wc_order_id,
                        'processing'
                    );
                } catch (\Throwable $e) {}
            }

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} marked as Resolved (সমাধান হয়েছে)!",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        if ($action === 'set_qty_one') {
            $prevQty = $order->quantity;
            $unitPrice = $order->unit_price ?: ($order->total_amount - $order->delivery_charge) / max(1, $prevQty);
            $newTotal = ($unitPrice * 1) + $order->delivery_charge;

            $cxNote = "[CX Review: Quantity adjusted from {$prevQty} to 1 by {$userName} on {$timeStr}]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['is_cx_resolved'] = true;
            $raw['cx_resolved_at'] = now()->toISOString();
            $raw['cx_resolved_by'] = $userName;

            $order->update([
                'quantity' => 1,
                'total_amount' => $newTotal,
                'order_status' => 'confirmed',
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} quantity adjusted to 1 and resolved! Total: ৳{$newTotal}",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        if ($action === 'confirm') {
            $cxNote = "[CX Verified & Confirmed by {$userName} on {$timeStr}]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['is_cx_resolved'] = true;
            $raw['cx_resolved_at'] = now()->toISOString();
            $raw['cx_resolved_by'] = $userName;

            $order->update([
                'order_status' => 'confirmed',
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
            ]);

            if ($order->wc_order_id) {
                try {
                    app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                        (int) $order->wc_order_id,
                        'processing'
                    );
                } catch (\Throwable $e) {}
            }

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} confirmed and resolved successfully!",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        if ($action === 'cancel') {
            $reason = $validated['reason'] ?: 'Duplicate / customer cancelled during verification';
            $cxNote = "[CX Cancelled: {$reason} (by {$userName} on {$timeStr})]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['is_cx_resolved'] = true;
            $raw['cx_cancelled_at'] = now()->toISOString();
            $raw['cx_cancelled_by'] = $userName;

            $order->update([
                'order_status' => 'cancelled',
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
            ]);

            if ($order->wc_order_id) {
                try {
                    app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                        (int) $order->wc_order_id,
                        'cancelled'
                    );
                } catch (\Throwable $e) {}
            }

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} has been cancelled.",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        return response()->json(['status' => 'error', 'message' => 'Invalid action'], 400);
    }

    /**
     * Get Order Summary metrics, KPI counts, and trends by period & source.
     */
    public function summary(Request $request): JsonResponse
    {
        $period = $request->query('period', 'today');
        $source = $request->query('source', 'all');

        $startDate = null;
        $endDate = null;

        switch ($period) {
            case 'today':
                $startDate = Carbon::today()->startOfDay();
                $endDate = Carbon::today()->endOfDay();
                break;
            case 'yesterday':
                $startDate = Carbon::yesterday()->startOfDay();
                $endDate = Carbon::yesterday()->endOfDay();
                break;
            case 'this_week':
                $startDate = Carbon::now()->startOfWeek();
                $endDate = Carbon::now()->endOfWeek();
                break;
            case 'last_week':
                $startDate = Carbon::now()->subWeek()->startOfWeek();
                $endDate = Carbon::now()->subWeek()->endOfWeek();
                break;
            case 'this_month':
                $startDate = Carbon::now()->startOfMonth();
                $endDate = Carbon::now()->endOfMonth();
                break;
            case 'last_month':
                $startDate = Carbon::now()->subMonth()->startOfMonth();
                $endDate = Carbon::now()->subMonth()->endOfMonth();
                break;
            case 'custom':
                if ($request->filled('start_date') && $request->filled('end_date')) {
                    $startDate = Carbon::parse($request->start_date)->startOfDay();
                    $endDate = Carbon::parse($request->end_date)->endOfDay();
                }
                break;
            case 'all':
            default:
                // No date constraint
                break;
        }

        $applyFilters = function ($query) use ($startDate, $endDate, $source) {
            if ($startDate && $endDate) {
                $query->whereBetween('created_at', [$startDate, $endDate]);
            }

            if ($source === 'website') {
                $query->whereIn('order_source', ['woocommerce', 'web']);
            } elseif ($source === 'engagement') {
                $query->where(function ($sq) {
                    $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                        ->orWhereNull('order_source')
                        ->orWhere('order_source', '!=', 'woocommerce');
                });
            }
        };

        // KPI Counts
        $baseQuery = Order::query();
        $applyFilters($baseQuery);

        $totalOrders = (clone $baseQuery)->count();

        $deliveredOrders = (clone $baseQuery)->where(function ($q) {
            $q->where('order_status', 'delivered')
                ->orWhere('courier_status', 'delivered');
        })->count();

        $returnedOrders = (clone $baseQuery)->where(function ($q) {
            $q->whereIn('order_status', ['returned', 'cancelled'])
                ->orWhereIn('courier_status', ['cancelled', 'cancelled_approval_pending', 'cancelled_return_received']);
        })->count();

        $processingOrders = (clone $baseQuery)->where(function ($q) {
            $q->whereIn('order_status', ['processing', 'shipped'])
                ->whereNotIn('courier_status', ['delivered', 'cancelled', 'cancelled_return_received']);
        })->count();

        $pendingOrders = (clone $baseQuery)->whereIn('order_status', [
            'draft', 'pending_confirmation', 'confirmed'
        ])->whereNotIn('courier_status', ['delivered', 'cancelled', 'cancelled_return_received'])->count();

        $dispatchedTotal = $deliveredOrders + $returnedOrders;
        $deliveryRate = $dispatchedTotal > 0 ? round(($deliveredOrders / $dispatchedTotal) * 100, 1) : 0;
        $returnRate = $dispatchedTotal > 0 ? round(($returnedOrders / $dispatchedTotal) * 100, 1) : 0;

        // Breakdown by channel in this period
        $websiteCount = (clone $baseQuery)->whereIn('order_source', ['woocommerce', 'web'])->count();
        $engagementCount = $totalOrders - $websiteCount;

        // Daily trend (last 7 or 14 days if month/all, or matching period)
        $trendStart = $startDate ?: Carbon::now()->subDays(6)->startOfDay();
        $trendEnd = $endDate ?: Carbon::now()->endOfDay();

        $dailyStats = Order::select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('COUNT(*) as total'),
            DB::raw("SUM(CASE WHEN order_status = 'delivered' OR courier_status = 'delivered' THEN 1 ELSE 0 END) as delivered"),
            DB::raw("SUM(CASE WHEN order_status IN ('returned', 'cancelled') OR courier_status IN ('cancelled', 'cancelled_return_received') THEN 1 ELSE 0 END) as returned")
        )
            ->whereBetween('created_at', [$trendStart, $trendEnd])
            ->when($source === 'website', fn ($q) => $q->whereIn('order_source', ['woocommerce', 'web']))
            ->when($source === 'engagement', fn ($q) => $q->where(fn ($sq) => $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])->orWhereNull('order_source')->orWhere('order_source', '!=', 'woocommerce')))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date', 'asc')
            ->get();

        // Top Return Reasons breakdown
        $returnReasons = Order::select('return_reason', DB::raw('COUNT(*) as count'))
            ->whereNotNull('return_reason')
            ->where('return_reason', '!=', '')
            ->where(function ($q) {
                $q->whereIn('order_status', ['returned', 'cancelled'])
                    ->orWhereIn('courier_status', ['cancelled', 'cancelled_return_received']);
            })
            ->when($startDate && $endDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
            ->groupBy('return_reason')
            ->orderByDesc('count')
            ->limit(6)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'period' => $period,
                'source' => $source,
                'date_range' => [
                    'start' => $startDate?->toDateString(),
                    'end' => $endDate?->toDateString(),
                ],
                'kpis' => [
                    'total_orders' => $totalOrders,
                    'delivered_orders' => $deliveredOrders,
                    'returned_orders' => $returnedOrders,
                    'processing_orders' => $processingOrders,
                    'pending_orders' => $pendingOrders,
                    'delivery_rate' => $deliveryRate,
                    'return_rate' => $returnRate,
                    'website_count' => $websiteCount,
                    'engagement_count' => $engagementCount,
                ],
                'daily_trends' => $dailyStats,
                'top_return_reasons' => $returnReasons,
            ],
        ]);
    }

    /**
     * Get Returned & Cancelled Orders list with Customer info, Courier status, and Delivery Reasons.
     */
    public function returns(Request $request): JsonResponse
    {
        $period = $request->query('period', 'all');
        $source = $request->query('source', 'all');
        $search = trim($request->query('search', ''));

        $query = Order::with(['customer', 'product', 'variant'])
            ->where(function ($q) {
                $q->whereIn('order_status', ['returned', 'cancelled'])
                    ->orWhereIn('courier_status', ['cancelled', 'cancelled_approval_pending', 'cancelled_return_received', 'hold']);
            });

        // Source Filter
        if ($source === 'website') {
            $query->whereIn('order_source', ['woocommerce', 'web']);
        } elseif ($source === 'engagement') {
            $query->where(function ($sq) {
                $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                    ->orWhereNull('order_source')
                    ->orWhere('order_source', '!=', 'woocommerce');
            });
        }

        // Period Filter
        if ($period === 'today') {
            $query->whereBetween('created_at', [Carbon::today()->startOfDay(), Carbon::today()->endOfDay()]);
        } elseif ($period === 'yesterday') {
            $query->whereBetween('created_at', [Carbon::yesterday()->startOfDay(), Carbon::yesterday()->endOfDay()]);
        } elseif ($period === 'this_week') {
            $query->whereBetween('created_at', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
        } elseif ($period === 'this_month') {
            $query->whereBetween('created_at', [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()]);
        } elseif ($period === 'custom' && $request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                Carbon::parse($request->start_date)->startOfDay(),
                Carbon::parse($request->end_date)->endOfDay(),
            ]);
        }

        // Search Filter
        if (! empty($search)) {
            $cleanDigits = preg_replace('/[^0-9]/', '', $search);
            $cleanNum = ltrim($search, '#');

            $query->where(function ($q) use ($search, $cleanDigits, $cleanNum) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('return_reason', 'like', "%{$search}%")
                    ->orWhere('rider_note', 'like', "%{$search}%")
                    ->orWhere('tracking_code', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));

                if (! empty($cleanDigits)) {
                    $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                    $q->orWhere('customer_phone', 'like', "%{$cleanDigits}%")
                        ->orWhere('customer_phone', 'like', "%{$lastDigits}%");
                }

                if (! empty($cleanNum) && is_numeric($cleanNum)) {
                    $q->orWhere('wc_order_id', (int) $cleanNum);
                }
            });
        }

        $perPage = $request->integer('per_page', 25);
        $orders = $query->orderByDesc('returned_at')
            ->orderByDesc('updated_at')
            ->paginate($perPage);

        // Compute customer order and return history for each item
        $customerIds = collect($orders->items())->pluck('customer_id')->filter()->unique()->values();

        $customerStats = [];
        if ($customerIds->isNotEmpty()) {
            $stats = Order::select(
                'customer_id',
                DB::raw('COUNT(*) as total_orders'),
                DB::raw("SUM(CASE WHEN order_status IN ('returned', 'cancelled') OR courier_status IN ('cancelled', 'cancelled_return_received') THEN 1 ELSE 0 END) as total_returns")
            )
                ->whereIn('customer_id', $customerIds)
                ->groupBy('customer_id')
                ->get()
                ->keyBy('customer_id');

            foreach ($stats as $cid => $row) {
                $customerStats[$cid] = [
                    'total_orders' => (int) $row->total_orders,
                    'total_returns' => (int) $row->total_returns,
                ];
            }
        }

        // Transform items to attach customer history
        $orders->getCollection()->transform(function ($ord) use ($customerStats) {
            $stats = $customerStats[$ord->customer_id] ?? ['total_orders' => 1, 'total_returns' => 1];
            $ord->customer_total_orders = $stats['total_orders'];
            $ord->customer_total_returns = $stats['total_returns'];
            return $ord;
        });

        return response()->json([
            'status' => 'success',
            'data' => $orders,
        ]);
    }

    /**
     * Update Return Reason / Rider Note for an order.
     */
    public function updateReturnReason(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'return_reason' => 'required|string|max:500',
            'rider_note' => 'nullable|string|max:500',
            'order_status' => 'nullable|in:returned,cancelled,delivered,processing',
        ]);

        $updateData = [
            'return_reason' => $validated['return_reason'],
            'rider_note' => $validated['rider_note'] ?? $order->rider_note,
        ];

        if (! empty($validated['order_status'])) {
            $updateData['order_status'] = $validated['order_status'];
        } else {
            $updateData['order_status'] = 'returned';
        }

        if (in_array($updateData['order_status'], ['returned', 'cancelled']) && ! $order->returned_at) {
            $updateData['returned_at'] = now();
        }

        $order->update($updateData);

        // If WooCommerce order, notify WooCommerce of status change if applicable
        if ($order->wc_order_id && in_array($updateData['order_status'], ['returned', 'cancelled'])) {
            try {
                app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                    (int) $order->wc_order_id,
                    'cancelled'
                );
            } catch (\Throwable $e) {
                // Silently continue
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Return reason updated successfully!',
            'data' => $order->fresh(['customer', 'product', 'variant']),
        ]);
    }

    /**
     * Bulk sync live delivery status from Steadfast Courier.
     */
    public function syncCourierStatus(Request $request): JsonResponse
    {
        $service = app(SteadfastCourierService::class);
        $result = $service->syncPendingOrdersStatus(60);

        return response()->json([
            'status' => 'success',
            'message' => "Steadfast Courier sync complete: Checked {$result['total_checked']} orders, updated {$result['updated_count']}.",
            'data' => $result,
        ]);
    }

    /**
     * Check live status of a single order from Steadfast Courier.
     */
    public function checkSingleCourierStatus(Order $order): JsonResponse
    {
        $service = app(SteadfastCourierService::class);
        $result = $service->checkDeliveryStatus($order);

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
            'data' => $order->fresh(['customer', 'product', 'variant']),
        ]);
    }
}

