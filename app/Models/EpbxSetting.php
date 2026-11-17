<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EpbxSetting extends Model
{
    use HasFactory;

    protected $table = 'epbx_settings';

    protected $fillable = [
        'provider',
        'api_base_url',
        'api_token',
        'trunk_number',
        'default_extension',
        'extension_password',
        'sip_server',
        'sip_port',
        'web_dialer_url',
        'webhook_secret',
        'is_enabled',
        'auto_call_orders_enabled',
        'auto_call_delay_seconds',
        'order_call_custom_text',
        'order_call_confirm_text',
        'order_call_cancel_text',
        'order_call_key_1_action',
        'order_call_key_2_action',
        'order_call_agent_extension',
        'last_balance',
        'last_checked_at',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'auto_call_orders_enabled' => 'boolean',
        'auto_call_delay_seconds' => 'integer',
        'last_balance' => 'decimal:2',
        'last_checked_at' => 'datetime',
    ];
}

