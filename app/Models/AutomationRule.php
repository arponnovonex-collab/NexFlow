<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationRule extends Model
{
    protected $fillable = [
        'name',
        'scope',
        'social_account_id',
        'condition_type',
        'condition_payload',
        'action_type',
        'action_payload',
        'is_active',
        'priority',
    ];

    protected function casts(): array
    {
        return [
            'condition_payload' => 'array',
            'action_payload' => 'array',
            'is_active' => 'boolean',
            'priority' => 'integer',
        ];
    }

    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(SocialAccount::class);
    }
}

