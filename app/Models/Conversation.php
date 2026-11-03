<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Conversation extends Model
{
    protected $fillable = [
        'social_account_id',
        'customer_id',
        'platform',
        'channel_conversation_id',
        'status',
        'ai_mode',
        'is_human_takeover',
        'assigned_to_user_id',
        'last_message_at',
        'unread_count',
        'priority',
    ];

    protected function casts(): array
    {
        return [
            'is_human_takeover' => 'boolean',
            'last_message_at' => 'datetime',
            'unread_count' => 'integer',
        ];
    }

    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(SocialAccount::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    public function notes(): HasMany
    {
        return $this->hasMany(ConversationNote::class);
    }

    public function tags(): HasMany
    {
        return $this->hasMany(ConversationTag::class);
    }

    public function lead(): HasOne
    {
        return $this->hasOne(Lead::class);
    }

    public function followups(): HasMany
    {
        return $this->hasMany(LeadFollowup::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}

