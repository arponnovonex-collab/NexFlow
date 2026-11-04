<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourierSetting extends Model
{
    protected $fillable = [
        'provider',
        'api_key',
        'secret_key',
        'is_enabled',
        'contact_name',
        'contact_phone',
        'delivery_type',
        'last_balance',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'last_balance' => 'decimal:2',
            'metadata' => 'array',
        ];
    }
}
