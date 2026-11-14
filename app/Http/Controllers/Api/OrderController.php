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
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('customer_address', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%"));
            });
        }

        $orders = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

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
}

