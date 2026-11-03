<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\LeadStatusHistory;
use App\Models\Order;
use App\Models\Product;
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

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
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
            'customer_id' => 'required|exists:customers,id',
            'conversation_id' => 'nullable|exists:conversations,id',
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'required|numeric|min:0',
            'delivery_charge' => 'required|numeric|min:0',
            'customer_address' => 'required|string',
            'customer_phone' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $total = ($validated['unit_price'] * $validated['quantity']) + $validated['delivery_charge'];

        $order = DB::transaction(function () use ($validated, $user, $total) {
            $ord = Order::create([
                ...$validated,
                'order_number' => 'NEX-ORD-' . date('Y') . '-' . strtoupper(Str::random(6)),
                'user_id' => $user->id,
                'total_amount' => $total,
                'order_status' => 'confirmed',
                'payment_status' => 'unpaid',
                'order_source' => 'manual_inbox',
            ]);

            // Transition lead to converted if lead exists
            $lead = Lead::where('customer_id', $validated['customer_id'])->first();
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

        return response()->json([
            'status' => 'success',
            'message' => 'Order created and lead verified as Converted!',
            'data' => $order->load(['customer', 'product']),
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

        return response()->json([
            'status' => 'success',
            'message' => 'Order status updated successfully',
            'data' => $order,
        ]);
    }
}

