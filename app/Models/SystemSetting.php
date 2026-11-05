<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'group',
    ];

    /**
     * Helper to get a setting value with fallback.
     */
    public static function get(string $key, $default = null)
    {
        $setting = static::where('key', $key)->first();
        if (! $setting || $setting->value === null) {
            return $default;
        }

        $val = $setting->value;
        $decoded = json_decode($val, true);
        if (json_last_error() === JSON_ERROR_NONE && (is_array($decoded) || is_numeric($decoded) || is_bool($decoded))) {
            return $decoded;
        }

        return $val;
    }

    /**
     * Helper to set a setting value.
     */
    public static function set(string $key, $value, string $group = 'appearance'): self
    {
        if (is_array($value) || is_object($value)) {
            $value = json_encode($value);
        }

        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'group' => $group]
        );
    }
}

