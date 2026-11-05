<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use App\Models\MediaFolder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MediaFolderController extends Controller
{
    /**
     * List all media folders with file counts and global stats.
     */
    public function index(Request $request): JsonResponse
    {
        $query = MediaFolder::withCount('mediaFiles')->orderBy('name', 'asc');

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
        }

        $folders = $query->get();
        $totalFiles = MediaFile::count();
        $uncategorizedFiles = MediaFile::whereNull('folder_id')->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'folders' => $folders,
                'total_files' => $totalFiles,
                'uncategorized_files' => $uncategorizedFiles,
            ],
        ]);
    }

    /**
     * Create a new product or category folder.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'color' => 'nullable|string|max:30',
            'description' => 'nullable|string|max:500',
        ]);

        $folder = MediaFolder::create([
            'user_id' => $request->user()?->id,
            'name' => trim($validated['name']),
            'slug' => Str::slug($validated['name']) ?: 'folder-' . time(),
            'color' => $validated['color'] ?: '#6366f1',
            'description' => $validated['description'] ?? null,
        ]);

        $folder->loadCount('mediaFiles');

        return response()->json([
            'status' => 'success',
            'message' => 'Folder created successfully.',
            'data' => $folder,
        ], 201);
    }

    /**
     * Update folder name, color, or description.
     */
    public function update(Request $request, MediaFolder $folder): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'color' => 'nullable|string|max:30',
            'description' => 'nullable|string|max:500',
        ]);

        if (isset($validated['name'])) {
            $folder->name = trim($validated['name']);
            $folder->slug = Str::slug($validated['name']) ?: $folder->slug;
        }

        if ($request->has('color')) {
            $folder->color = $validated['color'] ?: '#6366f1';
        }

        if ($request->has('description')) {
            $folder->description = $validated['description'];
        }

        $folder->save();
        $folder->loadCount('mediaFiles');

        return response()->json([
            'status' => 'success',
            'message' => 'Folder updated successfully.',
            'data' => $folder,
        ]);
    }

    /**
     * Delete a folder (files inside become uncategorized, not deleted).
     */
    public function destroy(MediaFolder $folder): JsonResponse
    {
        // Unlink files so they are preserved
        MediaFile::where('folder_id', $folder->id)->update(['folder_id' => null]);

        $folder->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Folder removed. All media files have been moved to Uncategorized.',
        ]);
    }
}

