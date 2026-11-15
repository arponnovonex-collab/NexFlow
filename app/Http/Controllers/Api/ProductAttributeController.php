<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductAttributeController extends Controller
{
    /**
     * List all attributes with their values.
     */
    public function index(): JsonResponse
    {
        $attributes = ProductAttribute::with('values')->orderBy('sort_order')->orderBy('id')->get();

        return response()->json([
            'status' => 'success',
            'data' => $attributes,
        ]);
    }

    /**
     * Create a new attribute.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:100|unique:product_attributes,slug',
            'type' => 'nullable|string|in:button,select,color',
            'is_required' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'values' => 'nullable|array',
            'values.*.name' => 'required|string|max:100',
            'values.*.value' => 'nullable|string|max:255',
        ]);

        $slug = ! empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        if (ProductAttribute::where('slug', $slug)->exists()) {
            $slug .= '-' . Str::random(3);
        }

        $attribute = ProductAttribute::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'type' => $validated['type'] ?? 'button',
            'is_required' => $validated['is_required'] ?? false,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        if (! empty($validated['values'])) {
            foreach ($validated['values'] as $idx => $v) {
                ProductAttributeValue::create([
                    'attribute_id' => $attribute->id,
                    'name' => trim($v['name']),
                    'value' => ! empty($v['value']) ? trim($v['value']) : trim($v['name']),
                    'sort_order' => $idx + 1,
                ]);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Attribute created successfully',
            'data' => $attribute->load('values'),
        ], 201);
    }

    /**
     * Update an attribute.
     */
    public function update(Request $request, ProductAttribute $productAttribute): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'nullable|string|in:button,select,color',
            'is_required' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $productAttribute->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Attribute updated successfully',
            'data' => $productAttribute->load('values'),
        ]);
    }

    /**
     * Delete an attribute.
     */
    public function destroy(ProductAttribute $productAttribute): JsonResponse
    {
        $productAttribute->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Attribute deleted successfully',
        ]);
    }

    /**
     * Add a value to an attribute.
     */
    public function addValue(Request $request, ProductAttribute $attribute): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'value' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer',
        ]);

        $value = ProductAttributeValue::create([
            'attribute_id' => $attribute->id,
            'name' => trim($validated['name']),
            'value' => ! empty($validated['value']) ? trim($validated['value']) : trim($validated['name']),
            'sort_order' => $validated['sort_order'] ?? ($attribute->values()->max('sort_order') + 1),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Value added successfully',
            'data' => $value,
        ], 201);
    }

    /**
     * Delete a value from an attribute.
     */
    public function deleteValue(ProductAttribute $attribute, ProductAttributeValue $value): JsonResponse
    {
        if ($value->attribute_id !== $attribute->id) {
            return response()->json(['status' => 'error', 'message' => 'Invalid value for attribute'], 400);
        }

        $value->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Value deleted successfully',
        ]);
    }
}
