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

                // 3. Customer address match
                $q->orWhere('customer_address', 'like', "%{$rawSearch}%");

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

        $orders = $query->orderByDesc('created_at')->paginate($perPage);

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
            'conversation_id' => 'nullable|exists:conversations,id',
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
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
        if (! $customerId) {
            $customer = Customer::firstOrCreate(
                ['phone' => $validated['customer_phone']],
                ['name' => $validated['customer_name'] ?? 'Customer']
            );
            $customerId = $customer->id;
        } else {
            // Update customer phone if provided
            Customer::where('id', $customerId)->update([
                'phone' => $validated['customer_phone'],
            ]);
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
            'quantity' => $validated['quantity'],
            'unit_price' => $validated['unit_price'],
            'delivery_charge' => $validated['delivery_charge'],
            'total_amount' => $total,
            'order_status' => 'confirmed',
            'payment_status' => 'unpaid',
            'order_source' => ! empty($validated['conversation_id']) ? 'manual_inbox' : 'web',
            'customer_address' => $validated['customer_address'],
            'customer_phone' => $validated['customer_phone'],
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

