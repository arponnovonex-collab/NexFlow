<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavedMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class SavedMessageController extends Controller
{
    /**
     * Display a listing of saved messages.
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $category = $request->query('category');
        $fetchAll = $request->boolean('all', false);

        $query = SavedMessage::query();

        if ($fetchAll) {
            $query->where('is_active', true);
        }

        if (! empty($search)) {
            $query->search($search);
        }

        if (! empty($category) && $category !== 'all') {
            $query->where('category', $category);
        }

        if ($fetchAll) {
            $messages = $query->orderByDesc('usage_count')->orderBy('title')->get();

            return response()->json([
                'success' => true,
                'data' => $messages,
            ]);
        }

        $perPage = (int) $request->query('per_page', 15);
        $messages = $query->latest('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $messages->items(),
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'per_page' => $messages->perPage(),
                'total' => $messages->total(),
            ],
        ]);
    }

    /**
     * Store a newly created saved message.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:191',
            'content' => 'required|string',
            'image_url' => 'nullable|string|max:500',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:5120',
            'shortcut' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
        ]);

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            if ($file->isValid()) {
                $targetDir = public_path('uploads/saved_messages');
                if (! File::isDirectory($targetDir)) {
                    File::makeDirectory($targetDir, 0755, true, true);
                }
                $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
                $filename = 'saved_msg_' . time() . '_' . Str::random(8) . '.' . $ext;
                $file->move($targetDir, $filename);
                $validated['image_url'] = url("uploads/saved_messages/{$filename}");
            }
        }

        $validated['user_id'] = $request->user()?->id;
        $validated['category'] = $validated['category'] ?? 'general';
        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['usage_count'] = 0;

        if (! empty($validated['shortcut']) && ! str_starts_with($validated['shortcut'], '/')) {
            $validated['shortcut'] = '/' . ltrim($validated['shortcut'], '/');
        }

        $savedMessage = SavedMessage::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Saved message created successfully.',
            'data' => $savedMessage,
        ], 201);
    }

    /**
     * Display the specified saved message.
     */
    public function show(SavedMessage $savedMessage): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $savedMessage,
        ]);
    }

    /**
     * Update the specified saved message.
     */
    public function update(Request $request, SavedMessage $savedMessage): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:191',
            'content' => 'sometimes|required|string',
            'image_url' => 'nullable|string|max:500',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:5120',
            'remove_image' => 'nullable|boolean',
            'shortcut' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
        ]);

        if ($request->boolean('remove_image')) {
            $validated['image_url'] = null;
        } elseif ($request->hasFile('image')) {
            $file = $request->file('image');
            if ($file->isValid()) {
                $targetDir = public_path('uploads/saved_messages');
                if (! File::isDirectory($targetDir)) {
                    File::makeDirectory($targetDir, 0755, true, true);
                }
                $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
                $filename = 'saved_msg_' . time() . '_' . Str::random(8) . '.' . $ext;
                $file->move($targetDir, $filename);
                $validated['image_url'] = url("uploads/saved_messages/{$filename}");
            }
        }

        if (isset($validated['shortcut']) && ! empty($validated['shortcut']) && ! str_starts_with($validated['shortcut'], '/')) {
            $validated['shortcut'] = '/' . ltrim($validated['shortcut'], '/');
        }

        $savedMessage->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Saved message updated successfully.',
            'data' => $savedMessage,
        ]);
    }

    /**
     * Upload an image file for saved messages.
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:5120',
        ]);

        $file = $request->file('image');
        $targetDir = public_path('uploads/saved_messages');
        if (! File::isDirectory($targetDir)) {
            File::makeDirectory($targetDir, 0755, true, true);
        }

        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $filename = 'saved_msg_' . time() . '_' . Str::random(8) . '.' . $ext;
        $file->move($targetDir, $filename);
        $imageUrl = url("uploads/saved_messages/{$filename}");

        return response()->json([
            'success' => true,
            'image_url' => $imageUrl,
            'file_name' => $file->getClientOriginalName(),
        ]);
    }

    /**
     * Remove the specified saved message.
     */
    public function destroy(SavedMessage $savedMessage): JsonResponse
    {
        $savedMessage->delete();

        return response()->json([
            'success' => true,
            'message' => 'Saved message deleted successfully.',
        ]);
    }

    /**
     * Increment usage counter when used in inbox.
     */
    public function incrementUsage(SavedMessage $savedMessage): JsonResponse
    {
        $savedMessage->increment('usage_count');

        return response()->json([
            'success' => true,
            'usage_count' => $savedMessage->usage_count,
        ]);
    }
}

