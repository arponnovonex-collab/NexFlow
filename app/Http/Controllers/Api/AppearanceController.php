<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class AppearanceController extends Controller
{
    /**
     * Get current branding and color appearance settings.
     */
    public function get(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => [
                'app_name' => SystemSetting::get('app_name', 'NexFlow AI'),
                'app_tagline' => SystemSetting::get('app_tagline', 'One Inbox. Every Conversation. Smarter Sales.'),
                'app_logo_url' => SystemSetting::get('app_logo_url', null),
                'app_favicon_url' => SystemSetting::get('app_favicon_url', null),
                'primary_color' => SystemSetting::get('primary_color', '#6366f1'),
                'secondary_color' => SystemSetting::get('secondary_color', '#8b5cf6'),
            ],
        ]);
    }

    /**
     * Update branding, site title, tagline, logo, and theme colors.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'app_name' => 'nullable|string|max:100',
            'app_tagline' => 'nullable|string|max:200',
            'primary_color' => 'nullable|string|max:25',
            'secondary_color' => 'nullable|string|max:25',
            'logo' => 'nullable|file|mimes:jpeg,png,jpg,webp,svg|max:4096',
            'favicon' => 'nullable|file|mimes:ico,png,svg,jpg,jpeg|max:2048',
        ]);

        if ($request->filled('app_name')) {
            SystemSetting::set('app_name', trim($request->app_name));
        }

        if ($request->has('app_tagline')) {
            SystemSetting::set('app_tagline', trim((string) $request->app_tagline));
        }

        if ($request->filled('primary_color')) {
            SystemSetting::set('primary_color', trim($request->primary_color));
        }

        if ($request->filled('secondary_color')) {
            SystemSetting::set('secondary_color', trim($request->secondary_color));
        }

        $brandingDir = public_path('uploads/branding');
        if (! File::isDirectory($brandingDir)) {
            File::makeDirectory($brandingDir, 0755, true, true);
        }

        if ($request->hasFile('logo')) {
            $file = $request->file('logo');
            $extension = $file->getClientOriginalExtension() ?: 'png';
            $fileName = 'logo_' . time() . '_' . Str::random(6) . '.' . $extension;
            $file->move($brandingDir, $fileName);
            $logoUrl = url('uploads/branding/' . $fileName);
            SystemSetting::set('app_logo_url', $logoUrl);
        } elseif ($request->has('remove_logo') && $request->boolean('remove_logo')) {
            SystemSetting::set('app_logo_url', null);
        }

        if ($request->hasFile('favicon')) {
            $file = $request->file('favicon');
            $extension = $file->getClientOriginalExtension() ?: 'png';
            $fileName = 'favicon_' . time() . '_' . Str::random(6) . '.' . $extension;
            $file->move($brandingDir, $fileName);
            $faviconUrl = url('uploads/branding/' . $fileName);
            SystemSetting::set('app_favicon_url', $faviconUrl);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Appearance settings updated successfully.',
            'data' => [
                'app_name' => SystemSetting::get('app_name', 'NexFlow AI'),
                'app_tagline' => SystemSetting::get('app_tagline', 'One Inbox. Every Conversation. Smarter Sales.'),
                'app_logo_url' => SystemSetting::get('app_logo_url', null),
                'app_favicon_url' => SystemSetting::get('app_favicon_url', null),
                'primary_color' => SystemSetting::get('primary_color', '#6366f1'),
                'secondary_color' => SystemSetting::get('secondary_color', '#8b5cf6'),
            ],
        ]);
    }
}

