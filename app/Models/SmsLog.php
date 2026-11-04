<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsLog extends Model
{
    protected $fillable = [
        'campaign_id',
        'order_id',
        'customer_id',
        'phone_number',
        'message',
        'type',
        'status',
        'response_code',
        'error_message',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(SmsCampaign::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
