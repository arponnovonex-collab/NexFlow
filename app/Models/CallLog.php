<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallLog extends Model
{
    use HasFactory;

    protected $table = 'call_logs';

    protected $fillable = [
        'call_session_id',
        'direction',
        'customer_phone',
        'customer_id',
        'agent_user_id',
        'agent_extension',
        'trunk_number',
        'status',
        'duration_seconds',
        'recording_url',
        'cost',
        'disposition',
        'notes',
        'started_at',
        'answered_at',
        'ended_at',
    ];

    protected $casts = [
        'duration_seconds' => 'integer',
        'cost' => 'decimal:2',
        'started_at' => 'datetime',
        'answered_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_user_id');
    }
}
