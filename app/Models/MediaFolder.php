<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class MediaFolder extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'color',
        'description',
        'parent_id',
    ];

    protected static function booted(): void
    {
        static::creating(function ($folder) {
            if (empty($folder->slug)) {
                $folder->slug = Str::slug($folder->name) ?: 'folder-' . time();
            }
        });

        static::updating(function ($folder) {
            if ($folder->isDirty('name') && empty($folder->slug)) {
                $folder->slug = Str::slug($folder->name) ?: 'folder-' . time();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function mediaFiles(): HasMany
    {
        return $this->hasMany(MediaFile::class, 'folder_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(MediaFolder::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(MediaFolder::class, 'parent_id');
    }
}
