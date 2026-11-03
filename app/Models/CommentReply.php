<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommentReply extends Model
{
    protected $fillable = [
        'social_comment_id',
        'reply_text',
        'sender_type',
        'user_id',
        'platform_reply_id',
        'status',
    ];

    public function comment(): BelongsTo
    {
        return $this->belongsTo(SocialComment::class, 'social_comment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

