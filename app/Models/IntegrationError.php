<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntegrationError extends Model
{
    protected $fillable = [
        'platform',
        'endpoint',
        'error_message',
        'request_payload',
        'response_payload',
        'resolved',
    ];

    protected function casts(): array
    {
        return [
            'request_payload' => 'array',
            'response_payload' => 'array',
            'resolved' => 'boolean',
        ];
    }
}

