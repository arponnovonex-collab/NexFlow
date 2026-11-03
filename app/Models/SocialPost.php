<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SocialPost extends Model
{
    protected $fillable = [
        'social_account_id',
        'platform_post_id',
        'message',
        'media_url',
        'permalink',
        'is_auto_reply_enabled',
        'reply_tone',
        'ai_model',
        'manual_approval_required',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'is_auto_reply_enabled' => 'boolean',
            'manual_approval_required' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(SocialAccount::class);
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'post_product_mappings');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(SocialComment::class);
    }
}

