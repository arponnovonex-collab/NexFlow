<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    /**
     * List all media files with search and type filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = MediaFile::with('user:id,name')->orderByDesc('created_at');

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('file_type', $request->type);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('file_name', 'like', "%{$search}%")
                  ->orWhere('title', 'like', "%{$search}%");
            });
        }

        // Support both paginated and full list for modal pickers
        if ($request->boolean('all')) {
            $media = $query->limit(150)->get();
            return response()->json([
                'status' => 'success',
                'data' => $media,
            ]);
        }

        $perPage = $request->integer('per_page', 28);
        $media = $query->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $media,
        ]);
    }

    /**
     * Upload single or multiple media files from desktop.
     */
    public function upload(Request $request): JsonResponse
    {
        // Support either 'file' (single) or 'files' (array)
        $uploadedFiles = [];
        if ($request->hasFile('file')) {
            $uploadedFiles[] = $request->file('file');
        } elseif ($request->hasFile('files')) {
            $uploadedFiles = $request->file('files');
        }

        if (empty($uploadedFiles)) {
            return response()->json([
                'status' => 'error',
                'message' => 'No files were provided for upload.',
            ], 422);
        }

        $year = date('Y');
        $month = date('m');
        $relativeDir = "uploads/media/{$year}/{$month}";
        $targetDir = public_path($relativeDir);

        if (! File::isDirectory($targetDir)) {
            File::makeDirectory($targetDir, 0755, true, true);
        }

        $userId = $request->user()?->id;
        $createdRecords = [];

        foreach ($uploadedFiles as $file) {
            if (! $file->isValid()) {
                continue;
            }

            $originalName = $file->getClientOriginalName();
            $extension = strtolower($file->getClientOriginalExtension() ?: 'bin');
            $mimeType = $file->getMimeType() ?: '';
            $fileSize = $file->getSize();

            // Determine broad file type: image, video, audio, document
            $fileType = 'document';
            if (str_starts_with($mimeType, 'image/') || in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'])) {
                $fileType = 'image';
            } elseif (str_starts_with($mimeType, 'video/') || in_array($extension, ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'])) {
                $fileType = 'video';
            } elseif (str_starts_with($mimeType, 'audio/') || in_array($extension, ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'])) {
                $fileType = 'audio';
            }

            // Safe unique file name
            $baseName = pathinfo($originalName, PATHINFO_FILENAME);
            $cleanBase = Str::slug(substr($baseName, 0, 40)) ?: 'media';
            $fileName = $cleanBase . '_' . time() . '_' . Str::random(5) . '.' . $extension;

            $file->move($targetDir, $fileName);

            $storedRelativePath = "{$relativeDir}/{$fileName}";
            $fileUrl = url($storedRelativePath);

            $width = null;
            $height = null;
            if ($fileType === 'image' && in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                $imageInfo = @getimagesize("{$targetDir}/{$fileName}");
                if ($imageInfo) {
                    $width = $imageInfo[0] ?? null;
                    $height = $imageInfo[1] ?? null;
                }
            }

            $media = MediaFile::create([
                'user_id' => $userId,
                'title' => $baseName,
                'file_name' => $originalName,
                'file_path' => $storedRelativePath,
                'file_url' => $fileUrl,
                'file_type' => $fileType,
                'mime_type' => $mimeType,
                'file_size' => $fileSize,
                'width' => $width,
                'height' => $height,
            ]);

            $createdRecords[] = $media;
        }

        return response()->json([
            'status' => 'success',
            'message' => count($createdRecords) . ' file(s) uploaded successfully.',
            'data' => count($createdRecords) === 1 ? $createdRecords[0] : $createdRecords,
        ]);
    }

    /**
     * Delete a media file.
     */
    public function destroy(MediaFile $media): JsonResponse
    {
        $fullPath = public_path($media->file_path);
        if (File::exists($fullPath)) {
            File::delete($fullPath);
        }

        $media->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Media file deleted successfully.',
        ]);
    }
}

