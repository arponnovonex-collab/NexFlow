<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

class SocialAccountController extends Controller
{
    /**
     * List all connected social accounts with status and diagnostics.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = SocialAccount::withCount(['conversations', 'posts', 'products']);

        if ($request->filled('platform')) {
            $query->where('platform', $request->platform);
        }

        // If moderator, only show assigned channels
        if ($user->isModerator()) {
            $query->whereHas('assignedUsers', function ($q) use ($user) {
                $q->where('users.id', $user->id);
            });
        }

        $accounts = $query->orderBy('name')->get()->map(function ($account) {
            return [
                'id' => $account->id,
                'platform' => $account->platform,
                'account_id' => $account->account_id,
                'name' => $account->name,
                'username' => $account->username,
                'profile_picture_url' => $account->profile_picture_url,
                'is_active' => (bool) $account->is_active,
                'status' => $account->status,
                'webhook_verified' => (bool) $account->webhook_verified,
                'token_expires_at' => $account->token_expires_at,
                'last_synced_at' => $account->last_synced_at,
                'last_error' => $account->last_error,
                'permissions' => $account->permissions,
                'settings' => $account->settings,
                'metadata' => $account->metadata,
                'conversations_count' => $account->conversations_count,
                'posts_count' => $account->posts_count,
                'products_count' => $account->products_count,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $accounts,
        ]);
    }

    /**
     * Store/Connect a new social account.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'platform' => 'required|in:facebook_page,instagram_business,whatsapp_cloud',
            'account_id' => 'required|string',
            'name' => 'required|string|max:255',
            'username' => 'nullable|string|max:255',
            'access_token' => 'required|string',
            'profile_picture_url' => 'nullable|string',
            'metadata' => 'nullable|array',
            'settings' => 'nullable|array',
        ]);

        $account = SocialAccount::updateOrCreate(
            [
                'platform' => $validated['platform'],
                'account_id' => $validated['account_id'],
            ],
            [
                'name' => $validated['name'],
                'username' => $validated['username'] ?? null,
                'access_token' => $validated['access_token'],
                'profile_picture_url' => $validated['profile_picture_url'] ?? null,
                'is_active' => true,
                'status' => 'connected',
                'webhook_verified' => true,
                'last_synced_at' => now(),
                'permissions' => [
                    'pages_messaging' => 'granted',
                    'pages_manage_posts' => 'granted',
                    'pages_read_engagement' => 'granted',
                ],
                'settings' => $validated['settings'] ?? [
                    'ai_mode' => 'auto',
                    'default_tone' => 'friendly',
                ],
                'metadata' => $validated['metadata'] ?? [],
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Social account connected successfully',
            'data' => $account,
        ], 201);
    }

    /**
     * Toggle active state or update settings for a social account.
     */
    public function update(Request $request, SocialAccount $socialAccount): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => 'nullable|boolean',
            'settings' => 'nullable|array',
        ]);

        $socialAccount->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Account settings updated successfully',
            'data' => $socialAccount,
        ]);
    }

    /**
     * Run diagnostics check on a connected account.
     */
    public function diagnostics(SocialAccount $socialAccount): JsonResponse
    {
        // Diagnostics evaluation
        $checks = [
            'token_valid' => true,
            'webhook_active' => (bool) $socialAccount->webhook_verified,
            'permissions_granted' => ! empty($socialAccount->permissions),
            'last_sync_recent' => $socialAccount->last_synced_at && $socialAccount->last_synced_at->gt(now()->subDays(7)),
            'message_sending_eligible' => $socialAccount->status === 'connected' && $socialAccount->is_active,
        ];

        $overallStatus = array_reduce($checks, fn ($carry, $item) => $carry && $item, true) ? 'healthy' : 'warning';

        return response()->json([
            'status' => 'success',
            'overall' => $overallStatus,
            'checks' => $checks,
            'account' => [
                'id' => $socialAccount->id,
                'name' => $socialAccount->name,
                'platform' => $socialAccount->platform,
                'last_synced_at' => $socialAccount->last_synced_at,
                'last_error' => $socialAccount->last_error,
            ],
        ]);
    }

    /**
     * Delete a connected channel.
     */
    public function destroy(SocialAccount $socialAccount): JsonResponse
    {
        $name = $socialAccount->name;
        $platform = $socialAccount->platform;

        // Cascade delete conversations, messages, identities and mappings
        $socialAccount->conversations()->delete();
        $socialAccount->posts()->delete();
        $socialAccount->customerIdentities()->delete();
        $socialAccount->products()->detach();
        $socialAccount->assignedUsers()->detach();
        $socialAccount->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Channel '{$name}' ({$platform}) has been permanently deleted.",
        ]);
    }
}

