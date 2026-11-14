<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'wc_order_id',
        'customer_id',
        'conversation_id',
        'user_id',
        'product_id',
        'variant_id',
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
        'notes',
        'courier_name',
        'consignment_id',
        'tracking_code',
        'courier_status',
        'courier_sent_at',
        'courier_response',
        'wc_raw_data',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'delivery_charge' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'items_data' => 'array',
            'courier_sent_at' => 'datetime',
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

