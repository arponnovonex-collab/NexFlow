<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    /**
     * List all products with category, variants, and stock summary.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'variants', 'images', 'socialAccounts:id,platform,name']);

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('availability')) {
            $query->where('availability', $request->availability);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('short_description', 'like', "%{$search}%");
            });
        }

        $products = $query->orderBy('name')->paginate($request->integer('per_page', 20));

        return response()->json([
            'status' => 'success',
            'data' => $products,
        ]);
    }

    /**
     * Create a new product with variants.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'required|string|unique:products,sku',
            'category_id' => 'nullable|exists:product_categories,id',
            'short_description' => 'nullable|string',
            'full_description' => 'nullable|string',
            'regular_price' => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'material' => 'nullable|string',
            'features' => 'nullable|array',
            'availability' => 'required|in:in_stock,out_of_stock,pre_order',
            'delivery_charge_inside_dhaka' => 'nullable|numeric',
            'delivery_charge_outside_dhaka' => 'nullable|numeric',
            'estimated_delivery_time' => 'nullable|string',
            'return_policy' => 'nullable|string',
            'exchange_policy' => 'nullable|string',
            'faqs' => 'nullable|array',
            'internal_notes' => 'nullable|string',
            'variants' => 'nullable|array',
            'variants.*.size' => 'nullable|string',
            'variants.*.color' => 'nullable|string',
            'variants.*.sku' => 'nullable|string',
            'variants.*.price' => 'nullable|numeric',
            'variants.*.stock' => 'nullable|integer',
            'social_account_ids' => 'nullable|array',
        ]);

        $product = Product::create([
            ...$validated,
            'slug' => Str::slug($validated['name']) . '-' . Str::random(4),
            'delivery_charge_inside_dhaka' => $validated['delivery_charge_inside_dhaka'] ?? 70.00,
            'delivery_charge_outside_dhaka' => $validated['delivery_charge_outside_dhaka'] ?? 130.00,
            'is_active' => true,
        ]);

        if (! empty($validated['variants'])) {
            foreach ($validated['variants'] as $v) {
                ProductVariant::create([
                    'product_id' => $product->id,
                    'size' => $v['size'] ?? null,
                    'color' => $v['color'] ?? null,
                    'sku' => $v['sku'] ?? ($product->sku . '-' . Str::random(3)),
                    'price' => $v['price'] ?? $product->selling_price,
                    'stock' => $v['stock'] ?? 0,
                    'is_active' => true,
                ]);
            }
        }

        if (! empty($validated['social_account_ids'])) {
            $product->socialAccounts()->sync($validated['social_account_ids']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Product created successfully',
            'product' => $product->load(['category', 'variants', 'socialAccounts']),
        ], 201);
    }

    /**
     * Show single product details.
     */
    public function show(Product $product): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'product' => $product->load(['category', 'variants', 'images', 'socialAccounts']),
        ]);
    }

    /**
     * Update product details and stock.
     */
    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'category_id' => 'nullable|exists:product_categories,id',
            'short_description' => 'nullable|string',
            'full_description' => 'nullable|string',
            'regular_price' => 'sometimes|required|numeric|min:0',
            'selling_price' => 'sometimes|required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'material' => 'nullable|string',
            'availability' => 'sometimes|required|in:in_stock,out_of_stock,pre_order',
            'delivery_charge_inside_dhaka' => 'nullable|numeric',
            'delivery_charge_outside_dhaka' => 'nullable|numeric',
            'return_policy' => 'nullable|string',
            'exchange_policy' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'social_account_ids' => 'nullable|array',
        ]);

        $product->update($validated);

        if (isset($validated['social_account_ids'])) {
            $product->socialAccounts()->sync($validated['social_account_ids']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Product updated successfully',
            'product' => $product->load(['category', 'variants', 'socialAccounts']),
        ]);
    }

    /**
     * Delete product.
     */
    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Product deleted successfully',
        ]);
    }

    /**
     * List categories.
     */
    public function categories(): JsonResponse
    {
        $categories = ProductCategory::withCount('products')->orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'data' => $categories,
        ]);
    }
}

