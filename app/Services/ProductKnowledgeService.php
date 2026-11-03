<?php

namespace App\Services;

use App\Models\Product;
use App\Models\SocialPost;

class ProductKnowledgeService
{
    /**
     * Build verified product knowledge context for a given social post or product ID.
     */
    public function getVerifiedContextForPost(SocialPost $post): array
    {
        $products = $post->products()->with(['variants' => function ($q) {
            $q->where('is_active', true);
        }])->where('is_active', true)->get();

        if ($products->isEmpty()) {
            return [
                'has_product' => false,
                'message' => 'No specific product mapped to this post. Fall back to general brand information and clarify with customer.',
                'products' => [],
            ];
        }

        $catalogContext = $products->map(function (Product $p) {
            $variantsStock = $p->variants->map(function ($v) {
                return [
                    'size' => $v->size,
                    'color' => $v->color,
                    'stock' => $v->stock,
                    'in_stock' => $v->stock > 0,
                    'price' => (float) ($v->price ?: $p->selling_price),
                ];
            });

            return [
                'product_id' => $p->id,
                'name' => $p->name,
                'sku' => $p->sku,
                'selling_price_bdt' => (float) $p->selling_price,
                'regular_price_bdt' => (float) $p->regular_price,
                'delivery_inside_dhaka_bdt' => (float) $p->delivery_charge_inside_dhaka,
                'delivery_outside_dhaka_bdt' => (float) $p->delivery_charge_outside_dhaka,
                'estimated_delivery' => $p->estimated_delivery_time,
                'variants' => $variantsStock,
                'return_policy' => $p->return_policy,
                'exchange_policy' => $p->exchange_policy,
                'faqs' => $p->faqs,
                'material' => $p->material,
            ];
        })->toArray();

        return [
            'has_product' => true,
            'products' => $catalogContext,
        ];
    }

    /**
     * Build knowledge context for a single product.
     */
    public function getVerifiedContextForProduct(Product $p): array
    {
        $p->load(['variants' => function ($q) {
            $q->where('is_active', true);
        }]);

        return [
            'product_id' => $p->id,
            'name' => $p->name,
            'sku' => $p->sku,
            'selling_price_bdt' => (float) $p->selling_price,
            'regular_price_bdt' => (float) $p->regular_price,
            'delivery_inside_dhaka_bdt' => (float) $p->delivery_charge_inside_dhaka,
            'delivery_outside_dhaka_bdt' => (float) $p->delivery_charge_outside_dhaka,
            'estimated_delivery' => $p->estimated_delivery_time,
            'variants' => $p->variants->map(fn ($v) => [
                'size' => $v->size,
                'color' => $v->color,
                'stock' => $v->stock,
                'in_stock' => $v->stock > 0,
            ])->toArray(),
            'return_policy' => $p->return_policy,
            'exchange_policy' => $p->exchange_policy,
            'faqs' => $p->faqs,
        ];
    }
}

