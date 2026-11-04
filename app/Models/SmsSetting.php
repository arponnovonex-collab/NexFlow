<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsSetting extends Model
{
    protected $fillable = [
        'provider',
        'api_key',
        'sender_id',
        'is_enabled',
        'auto_sms_enabled',
        'auto_sms_template',
        'last_balance',
        'last_balance_checked_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'auto_sms_enabled' => 'boolean',
            'last_balance' => 'decimal:2',
            'last_balance_checked_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
