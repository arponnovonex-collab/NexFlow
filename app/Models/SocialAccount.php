<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SocialAccount extends Model
{
    protected $fillable = [
        'platform',
        'account_id',
        'name',
        'username',
        'profile_picture_url',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'is_active',
        'status',
        'permissions',
        'webhook_verified',
        'last_synced_at',
        'last_error',
        'settings',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'token_expires_at' => 'datetime',
            'is_active' => 'boolean',
            'webhook_verified' => 'boolean',
            'last_synced_at' => 'datetime',
            'permissions' => 'array',
            'settings' => 'array',
            'metadata' => 'array',
        ];
    }

    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'social_account_assignments');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'account_product_mappings');
    }

    public function posts(): HasMany
    {
        return $this->hasMany(SocialPost::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function customerIdentities(): HasMany
    {
        return $this->hasMany(CustomerChannelIdentity::class);
    }
}

