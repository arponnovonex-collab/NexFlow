<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'sku',
        'slug',
        'short_description',
        'full_description',
        'regular_price',
        'selling_price',
        'discount_price',
        'material',
        'features',
        'availability',
        'product_url',
        'delivery_charge_inside_dhaka',
        'delivery_charge_outside_dhaka',
        'estimated_delivery_time',
        'return_policy',
        'exchange_policy',
        'faqs',
        'internal_notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'regular_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'discount_price' => 'decimal:2',
            'delivery_charge_inside_dhaka' => 'decimal:2',
            'delivery_charge_outside_dhaka' => 'decimal:2',
            'features' => 'array',
            'faqs' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function socialAccounts(): BelongsToMany
    {
        return $this->belongsToMany(SocialAccount::class, 'account_product_mappings');
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(SocialPost::class, 'post_product_mappings');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}

