<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiSuggestion extends Model
{
    protected $fillable = [
        'conversation_id',
        'user_id',
        'suggested_text',
        'intent',
        'confidence',
        'tone',
        'is_applied',
        'edited_text',
    ];

    protected function casts(): array
    {
        return [
            'confidence' => 'decimal:2',
            'is_applied' => 'boolean',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

