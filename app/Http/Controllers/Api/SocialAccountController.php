<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;

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
            $isPastExpiry = $account->token_expires_at && $account->token_expires_at->isPast();
            $status = $account->status;

            if ($isPastExpiry && $status === 'connected') {
                $status = 'expired';
                $account->update([
                    'status' => 'expired',
                    'last_error' => 'Token expired on ' . $account->token_expires_at->toFormattedDateString(),
                ]);
            }

            return [
                'id' => $account->id,
                'platform' => $account->platform,
                'account_id' => $account->account_id,
                'name' => $account->name,
                'username' => $account->username,
                'profile_picture_url' => $account->profile_picture_url,
                'is_active' => (bool) $account->is_active,
                'status' => $status,
                'is_token_expired' => ($status === 'expired' || $isPastExpiry),
                'is_permanent' => (bool) ($account->metadata['is_permanent'] ?? ($account->token_expires_at === null)),
                'webhook_verified' => (bool) $account->webhook_verified,
                'token_expires_at' => $account->token_expires_at?->toIso8601String(),
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
     * Inspect and validate Meta Page/User access token.
     */
    public static function inspectMetaToken(string $token, ?string $accountId = null, string $platform = 'facebook_page'): array
    {
        if (str_starts_with($token, 'EAAXMOCK')) {
            return [
                'is_valid' => true,
                'is_permanent' => true,
                'expires_at' => null,
                'type' => 'MOCK',
                'error' => null,
                'resolved_token' => $token,
                'resolved_name' => null,
            ];
        }

        $version = config('services.meta.graph_version', 'v19.0');
        $resolvedToken = $token;
        $resolvedName = null;

        // If it's a facebook page and accountId is provided, check if passing a user token yields the page token
        if ($platform === 'facebook_page' && $accountId) {
            try {
                $pageRes = Http::timeout(6)->get("https://graph.facebook.com/{$version}/{$accountId}", [
                    'fields' => 'access_token,name',
                    'access_token' => $token,
                ]);

                if ($pageRes->successful()) {
                    if (! empty($pageRes->json('access_token'))) {
                        $resolvedToken = $pageRes->json('access_token');
                    }
                    $resolvedName = $pageRes->json('name');
                } elseif ($pageRes->status() === 400 || $pageRes->status() === 401) {
                    $err = $pageRes->json('error');
                    if (isset($err['code']) && in_array($err['code'], [190, 102])) {
                        return [
                            'is_valid' => false,
                            'is_permanent' => false,
                            'expires_at' => null,
                            'type' => 'EXPIRED',
                            'error' => $err['message'] ?? 'Facebook token has expired or is invalid.',
                            'resolved_token' => $token,
                            'resolved_name' => null,
                        ];
                    }
                }
            } catch (\Exception $e) {
                // Silently continue to debug_token
            }
        }

        // Try debug_token on the resolved token
        try {
            $debugRes = Http::timeout(6)->get("https://graph.facebook.com/{$version}/debug_token", [
                'input_token' => $resolvedToken,
                'access_token' => $resolvedToken,
            ]);

            if ($debugRes->successful() && $debugRes->json('data')) {
                $data = $debugRes->json('data');
                $isValid = (bool) ($data['is_valid'] ?? false);
                $expiresAtTimestamp = (int) ($data['expires_at'] ?? 0);
                $isPermanent = ($expiresAtTimestamp === 0);

                if (! $isPermanent && $expiresAtTimestamp > 0 && $expiresAtTimestamp < time()) {
                    $isValid = false;
                    $error = 'Token expired on ' . date('Y-m-d H:i:s', $expiresAtTimestamp);
                } else {
                    $error = $isValid ? null : ($data['error']['message'] ?? 'Token is invalid or revoked.');
                }

                return [
                    'is_valid' => $isValid,
                    'is_permanent' => $isPermanent,
                    'expires_at' => (! $isPermanent && $expiresAtTimestamp > 0) ? \Illuminate\Support\Carbon::createFromTimestamp($expiresAtTimestamp) : null,
                    'type' => $data['type'] ?? 'PAGE',
                    'error' => $error,
                    'resolved_token' => $resolvedToken,
                    'resolved_name' => $resolvedName,
                ];
            }
        } catch (\Exception $e) {
            // debug_token failed
        }

        // Fallback probe endpoint with the resolved token
        try {
            $probeTarget = $accountId ?: 'me';
            $fields = ($platform === 'whatsapp_cloud') ? 'id,verified_name,display_phone_number' : 'id,name,username';
            $probeRes = Http::timeout(6)->get("https://graph.facebook.com/{$version}/{$probeTarget}", [
                'fields' => $fields,
                'access_token' => $resolvedToken,
            ]);

            if ($probeRes->successful()) {
                $resolvedName = ($platform === 'whatsapp_cloud')
                    ? ($probeRes->json('verified_name') ?: $probeRes->json('display_phone_number') ?: $resolvedName)
                    : ($probeRes->json('name') ?: $probeRes->json('username') ?: $resolvedName);

                return [
                    'is_valid' => true,
                    'is_permanent' => true,
                    'expires_at' => null,
                    'type' => ($platform === 'whatsapp_cloud') ? 'WHATSAPP' : 'PAGE',
                    'error' => null,
                    'resolved_token' => $resolvedToken,
                    'resolved_name' => $resolvedName,
                ];
            }

            $err = $probeRes->json('error');
            $errMsg = $err['message'] ?? 'Token validation failed with Meta.';
            return [
                'is_valid' => false,
                'is_permanent' => false,
                'expires_at' => null,
                'type' => 'INVALID',
                'error' => $errMsg,
                'resolved_token' => $resolvedToken,
                'resolved_name' => $resolvedName,
            ];
        } catch (\Exception $e) {
            return [
                'is_valid' => false,
                'is_permanent' => false,
                'expires_at' => null,
                'type' => 'ERROR',
                'error' => $e->getMessage(),
                'resolved_token' => $resolvedToken,
                'resolved_name' => $resolvedName,
            ];
        }
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

        $accessToken = $validated['access_token'];
        $accountId = $validated['account_id'];
        $name = $validated['name'];
        $version = config('services.meta.graph_version', 'v19.0');

        // Inspect token with Meta before connecting
        $inspection = self::inspectMetaToken($accessToken, $accountId, $validated['platform']);
        if (! $inspection['is_valid']) {
            return response()->json([
                'status' => 'error',
                'message' => 'Token Expired or Invalid: ' . ($inspection['error'] ?? 'Could not authenticate token with Meta. Please provide a valid Page Access Token.'),
            ], 422);
        }

        $accessToken = $inspection['resolved_token'];
        $name = $inspection['resolved_name'] ?: $name;

        // If Facebook Page, automatically subscribe feed & messages to this Page
        if ($validated['platform'] === 'facebook_page' && ! str_starts_with($accessToken, 'EAAXMOCK')) {
            try {
                Http::timeout(6)->post("https://graph.facebook.com/{$version}/{$accountId}/subscribed_apps", [
                    'subscribed_fields' => 'feed,messages,messaging_postbacks,message_echoes,standby,messaging_handovers',
                    'access_token' => $accessToken,
                ]);
            } catch (\Exception $e) {
                // Silently continue
            }
        }

        $metadata = $validated['metadata'] ?? [];
        $metadata['is_permanent'] = $inspection['is_permanent'];
        $metadata['token_type'] = $inspection['type'];

        $account = SocialAccount::updateOrCreate(
            [
                'platform' => $validated['platform'],
                'account_id' => $accountId,
            ],
            [
                'name' => $name,
                'username' => $validated['username'] ?? null,
                'access_token' => $accessToken,
                'profile_picture_url' => $validated['profile_picture_url'] ?? null,
                'is_active' => true,
                'status' => 'connected',
                'token_expires_at' => $inspection['expires_at'],
                'webhook_verified' => true,
                'last_synced_at' => now(),
                'last_error' => null,
                'permissions' => [
                    'pages_messaging' => 'granted',
                    'pages_manage_posts' => 'granted',
                    'pages_read_engagement' => 'granted',
                    'pages_manage_metadata' => 'granted',
                ],
                'settings' => $validated['settings'] ?? [
                    'ai_mode' => 'auto',
                    'default_tone' => 'friendly',
                ],
                'metadata' => $metadata,
            ]
        );

        // Automatically trigger initial post sync for facebook_page
        if ($account->platform === 'facebook_page' && ! str_starts_with($accessToken, 'EAAXMOCK')) {
            try {
                $postRes = Http::timeout(6)->get("https://graph.facebook.com/{$version}/{$accountId}/published_posts", [
                    'fields' => 'id,message,created_time,full_picture,permalink_url',
                    'limit' => 50,
                    'access_token' => $accessToken,
                ]);
                if ($postRes->successful()) {
                    foreach ($postRes->json('data') ?? [] as $item) {
                        \App\Models\SocialPost::updateOrCreate(
                            ['platform_post_id' => (string) $item['id']],
                            [
                                'social_account_id' => $account->id,
                                'message' => ! empty($item['message']) ? $item['message'] : 'Facebook Post #' . $item['id'],
                                'media_url' => $item['full_picture'] ?? null,
                                'permalink' => $item['permalink_url'] ?? null,
                                'published_at' => isset($item['created_time']) ? \Illuminate\Support\Carbon::parse($item['created_time']) : now(),
                                'is_auto_reply_enabled' => true,
                            ]
                        );
                    }
                }
            } catch (\Exception $e) {
                // Silently continue
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Social account connected successfully',
            'data' => $account,
        ], 201);
    }

    /**
     * Show social account details.
     */
    public function show(SocialAccount $socialAccount): JsonResponse
    {
        $socialAccount->loadCount(['conversations', 'posts', 'products']);
        $socialAccount->makeHidden(['access_token', 'refresh_token']);

        return response()->json([
            'status' => 'success',
            'data' => $socialAccount,
        ]);
    }

    /**
     * Subscribe Facebook Page to Meta webhooks (feed and messages).
     */
    public function subscribeWebhooks(SocialAccount $socialAccount): JsonResponse
    {
        if ($socialAccount->platform !== 'facebook_page') {
            return response()->json([
                'status' => 'error',
                'message' => 'Only Facebook Pages can be subscribed via Graph API.',
            ], 422);
        }

        $version = config('services.meta.graph_version', 'v19.0');
        $token = $socialAccount->access_token;
        $pageId = $socialAccount->account_id;

        // Ensure token is Page token
        if (! str_starts_with($token, 'EAAXMOCK')) {
            try {
                $pageRes = Http::timeout(6)->get("https://graph.facebook.com/{$version}/{$pageId}", [
                    'fields' => 'access_token',
                    'access_token' => $token,
                ]);
                if ($pageRes->successful() && ! empty($pageRes->json('access_token'))) {
                    $token = $pageRes->json('access_token');
                    $socialAccount->update(['access_token' => $token]);
                }
            } catch (\Exception $e) {
                // Silently continue
            }
        }

        // Try subscribing feed, messages, messaging_postbacks, message_echoes, standby, messaging_handovers
        $res = Http::post("https://graph.facebook.com/{$version}/{$pageId}/subscribed_apps", [
            'subscribed_fields' => 'feed,messages,messaging_postbacks,message_echoes,standby,messaging_handovers',
            'access_token' => $token,
        ]);

        if ($res->successful()) {
            return response()->json([
                'status' => 'success',
                'feed_subscribed' => true,
                'message' => 'Facebook Page feed (comments), messages, and message_echoes are successfully subscribed!',
                'data' => $res->json(),
            ]);
        }

        // If feed fails (e.g. missing pages_manage_metadata), fallback to messages, echoes, and standby
        $fallback = Http::post("https://graph.facebook.com/{$version}/{$pageId}/subscribed_apps", [
            'subscribed_fields' => 'messages,messaging_postbacks,message_echoes,standby,messaging_handovers',
            'access_token' => $token,
        ]);

        return response()->json([
            'status' => 'partial',
            'feed_subscribed' => false,
            'messages_subscribed' => $fallback->successful(),
            'meta_error' => $res->json('error.message'),
            'message' => 'Messages subscribed, but feed (comments) requires pages_manage_metadata permission.',
        ]);
    }

    /**
     * Toggle active state or update settings/token for a social account.
     */
    public function update(Request $request, SocialAccount $socialAccount): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => 'nullable|boolean',
            'settings' => 'nullable|array',
            'access_token' => 'nullable|string',
        ]);

        if (! empty($validated['access_token'])) {
            $token = $validated['access_token'];
            $inspection = self::inspectMetaToken($token, $socialAccount->account_id, $socialAccount->platform);

            if (! $inspection['is_valid']) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid or Expired Token: ' . ($inspection['error'] ?? 'Meta rejected this token.'),
                ], 422);
            }

            $validated['access_token'] = $inspection['resolved_token'];
            $validated['status'] = 'connected';
            $validated['is_active'] = true;
            $validated['last_error'] = null;
            $validated['last_synced_at'] = now();
            $validated['token_expires_at'] = $inspection['expires_at'];

            $metadata = $socialAccount->metadata ?? [];
            $metadata['is_permanent'] = $inspection['is_permanent'];
            $metadata['token_type'] = $inspection['type'];
            $validated['metadata'] = $metadata;

            // Re-subscribe webhooks
            if ($socialAccount->platform === 'facebook_page' && ! str_starts_with($validated['access_token'], 'EAAXMOCK')) {
                try {
                    $version = config('services.meta.graph_version', 'v19.0');
                    Http::timeout(6)->post("https://graph.facebook.com/{$version}/{$socialAccount->account_id}/subscribed_apps", [
                        'subscribed_fields' => 'feed,messages,messaging_postbacks,message_echoes,standby,messaging_handovers',
                        'access_token' => $validated['access_token'],
                    ]);
                } catch (\Exception $e) {
                    // Ignore webhook subscription errors
                }
            }
        }

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
        $inspection = self::inspectMetaToken($socialAccount->access_token, $socialAccount->account_id, $socialAccount->platform);
        $tokenValid = $inspection['is_valid'];
        $metaError = $inspection['error'];

        if (! $tokenValid && $socialAccount->status === 'connected') {
            $socialAccount->update([
                'status' => 'expired',
                'last_error' => $metaError,
            ]);
        } elseif ($tokenValid && $socialAccount->status === 'expired') {
            $socialAccount->update([
                'status' => 'connected',
                'last_error' => null,
                'token_expires_at' => $inspection['expires_at'],
            ]);
        }

        $checks = [
            'token_valid' => $tokenValid,
            'is_permanent_token' => (bool) $inspection['is_permanent'],
            'webhook_active' => (bool) $socialAccount->webhook_verified,
            'permissions_granted' => ! empty($socialAccount->permissions),
            'last_sync_recent' => $socialAccount->last_synced_at && $socialAccount->last_synced_at->gt(now()->subDays(7)),
            'message_sending_eligible' => $tokenValid && $socialAccount->status === 'connected' && $socialAccount->is_active,
        ];

        $overallStatus = array_reduce($checks, fn ($carry, $item) => $carry && $item, true) ? 'healthy' : 'warning';

        return response()->json([
            'status' => 'success',
            'overall' => $overallStatus,
            'meta_error' => $metaError,
            'token_details' => [
                'is_valid' => $tokenValid,
                'is_permanent' => $inspection['is_permanent'],
                'expires_at' => $inspection['expires_at']?->toIso8601String(),
                'type' => $inspection['type'],
            ],
            'checks' => $checks,
            'account' => [
                'id' => $socialAccount->id,
                'name' => $socialAccount->name,
                'platform' => $socialAccount->platform,
                'last_synced_at' => $socialAccount->last_synced_at,
                'last_error' => $metaError ?? $socialAccount->last_error,
            ],
        ]);
    }

    /**
     * Verify all active channels and check for expired tokens against Meta.
     */
    public function verifyAllTokens(Request $request): JsonResponse
    {
        $accounts = SocialAccount::all();
        $expiredCount = 0;
        $connectedCount = 0;
        $results = [];

        foreach ($accounts as $acc) {
            if (! $acc->access_token) {
                continue;
            }

            $inspection = self::inspectMetaToken($acc->access_token, $acc->account_id, $acc->platform);

            if (! $inspection['is_valid']) {
                $acc->update([
                    'status' => 'expired',
                    'last_error' => $inspection['error'] ?? 'Token has expired or was revoked.',
                ]);
                $expiredCount++;
                $results[] = [
                    'id' => $acc->id,
                    'name' => $acc->name,
                    'status' => 'expired',
                    'error' => $inspection['error'],
                ];
            } else {
                $acc->update([
                    'status' => 'connected',
                    'last_error' => null,
                    'token_expires_at' => $inspection['expires_at'],
                ]);
                $connectedCount++;
                $results[] = [
                    'id' => $acc->id,
                    'name' => $acc->name,
                    'status' => 'connected',
                    'is_permanent' => $inspection['is_permanent'],
                ];
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Health check complete: {$connectedCount} active channels, {$expiredCount} expired.",
            'connected_count' => $connectedCount,
            'expired_count' => $expiredCount,
            'details' => $results,
        ]);
    }

    /**
     * Disconnect a connected account (pauses integration without deleting data).
     */
    public function disconnect(SocialAccount $socialAccount): JsonResponse
    {
        $socialAccount->update([
            'status' => 'disconnected',
            'is_active' => false,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Channel '{$socialAccount->name}' has been disconnected.",
            'data' => $socialAccount,
        ]);
    }

    /**
     * Reconnect an account.
     */
    public function reconnect(Request $request, SocialAccount $socialAccount): JsonResponse
    {
        $token = $request->input('access_token') ?: $socialAccount->access_token;
        $inspection = self::inspectMetaToken($token, $socialAccount->account_id, $socialAccount->platform);

        if (! $inspection['is_valid']) {
            $socialAccount->update([
                'status' => 'expired',
                'last_error' => $inspection['error'] ?? 'Token has expired.',
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Cannot reconnect: The Facebook token has expired or is invalid. Please use "Update Token" to provide a fresh token.',
                'meta_error' => $inspection['error'],
            ], 422);
        }

        $socialAccount->update([
            'access_token' => $inspection['resolved_token'],
            'token_expires_at' => $inspection['expires_at'],
            'status' => 'connected',
            'is_active' => true,
            'last_error' => null,
            'last_synced_at' => now(),
        ]);

        // Subscribe webhooks
        if ($socialAccount->platform === 'facebook_page' && ! str_starts_with($socialAccount->access_token, 'EAAXMOCK')) {
            try {
                $version = config('services.meta.graph_version', 'v19.0');
                Http::timeout(6)->post("https://graph.facebook.com/{$version}/{$socialAccount->account_id}/subscribed_apps", [
                    'subscribed_fields' => 'feed,messages,messaging_postbacks,message_echoes,standby,messaging_handovers',
                    'access_token' => $socialAccount->access_token,
                ]);
            } catch (\Exception $e) {}
        }

        return response()->json([
            'status' => 'success',
            'message' => "Channel '{$socialAccount->name}' has been reconnected and verified with Meta.",
            'data' => $socialAccount,
        ]);
    }

    /**
     * Delete a connected channel permanently.
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

