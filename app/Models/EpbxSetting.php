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
        'last_balance',
        'last_checked_at',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'last_balance' => 'decimal:2',
        'last_checked_at' => 'datetime',
    ];
}

