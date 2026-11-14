<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WooCommerceSetting extends Model
{
    protected $table = 'woocommerce_settings';

    protected $fillable = [
        'store_url',
        'consumer_key',
        'consumer_secret',
        'is_enabled',
        'auto_sync_orders',
        'webhook_secret',
        'last_synced_at',
        'sync_status',
        'last_error',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'auto_sync_orders' => 'boolean',
            'last_synced_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
