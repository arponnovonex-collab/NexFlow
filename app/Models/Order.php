<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'wc_order_id',
        'created_at',
        'customer_id',
        'conversation_id',
        'user_id',
        'product_id',
        'variant_id',
        'size',
        'color',
        'order_attributes',
        'quantity',
        'items_data',
        'unit_price',
        'delivery_charge',
        'total_amount',
        'order_status',
        'payment_status',
        'payment_method_title',
        'shipping_method_title',
        'order_source',
        'customer_address',
        'customer_phone',
        'customer_email',
        'notes',
        'courier_name',
        'consignment_id',
        'tracking_code',
        'courier_status',
        'courier_sent_at',
        'courier_response',
        'return_reason',
        'rider_note',
        'returned_at',
        'wc_raw_data',
        'ai_call_status',
        'ai_call_session_id',
        'ai_call_count',
        'ai_call_last_at',
        'ai_call_recording_url',
        'ai_call_notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'delivery_charge' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'order_attributes' => 'array',
            'items_data' => 'array',
            'courier_sent_at' => 'datetime',
            'returned_at' => 'datetime',
            'ai_call_last_at' => 'datetime',
            'ai_call_count' => 'integer',
            'courier_response' => 'array',
            'wc_raw_data' => 'array',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }
}

