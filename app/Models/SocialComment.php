<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SocialComment extends Model
{
    protected $fillable = [
        'social_post_id',
        'platform_comment_id',
        'parent_comment_id',
        'customer_name',
        'platform_user_id',
        'message',
        'intent',
        'sentiment',
        'reply_status',
        'reply_text',
        'is_page_owned',
    ];

    protected function casts(): array
    {
        return [
            'is_page_owned' => 'boolean',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(CommentReply::class);
    }
}

