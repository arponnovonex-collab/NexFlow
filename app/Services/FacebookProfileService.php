<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerChannelIdentity;
use App\Models\SocialAccount;
use App\Models\SocialComment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FacebookProfileService
{
    /**
     * Resolve and update customer real name and profile picture using Page Conversations API, Comments, or Graph API.
     */
    public static function resolveCustomerName(?SocialAccount $account, string $senderPsid, ?Customer $customer = null): ?string
    {
        // 1. Check if user already commented on a Facebook post with their real name
        $comment = SocialComment::where('platform_user_id', $senderPsid)
            ->whereNotNull('customer_name')
            ->where('customer_name', '!=', '')
            ->where('customer_name', 'not like', 'Facebook%')
            ->latest()
            ->first();

        if ($comment) {
            self::applyName($customer, $senderPsid, $comment->customer_name);
        }

        if (! $account || ! $account->access_token || str_starts_with($account->access_token, 'EAAXMOCK')) {
            return $customer?->name;
        }

        $version = config('services.meta.graph_version', 'v19.0');

        // Handle Instagram Business Accounts
        if ($account->platform === 'instagram_business') {
            try {
                $igRes = Http::timeout(3.5)->get("https://graph.facebook.com/{$version}/{$senderPsid}", [
                    'fields' => 'name,username,profile_pic',
                    'access_token' => $account->access_token,
                ]);
                if ($igRes->successful()) {
                    $igData = $igRes->json();
                    $igName = trim($igData['name'] ?? $igData['username'] ?? '');
                    $igPic = $igData['profile_pic'] ?? null;
                    if (! empty($igName) || ! empty($igPic)) {
                        self::applyName($customer, $senderPsid, $igName ?: 'Instagram Customer', $igPic);
                        return $igName;
                    }
                }
            } catch (\Throwable $e) {
                // Ignore
            }
        }

        // 2. High-success method: Fetch Page Conversations with participants{id,name,picture}
        try {
            $convRes = Http::timeout(4.5)->get("https://graph.facebook.com/{$version}/{$account->account_id}/conversations", [
                'fields' => 'id,participants{id,name,picture}',
                'access_token' => $account->access_token,
                'limit' => 30,
            ]);

            if ($convRes->successful()) {
                $conversations = $convRes->json('data') ?? [];
                foreach ($conversations as $conv) {
                    $participants = $conv['participants']['data'] ?? [];
                    foreach ($participants as $p) {
                        $pId = (string) ($p['id'] ?? '');
                        $pName = trim($p['name'] ?? '');
                        $pPic = $p['picture']['data']['url'] ?? null;

                        if ($pId === (string) $senderPsid && ! empty($pName) && ! str_starts_with($pName, 'Facebook')) {
                            self::applyName($customer, $senderPsid, $pName, $pPic);
                            return $pName;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning("FacebookProfileService conversations error for account {$account->id}: " . $e->getMessage());
        }

        // 3. Direct PSID Graph API lookup (name and profile_pic)
        try {
            $res = Http::timeout(3.0)->get("https://graph.facebook.com/{$version}/{$senderPsid}", [
                'fields' => 'name,first_name,last_name,profile_pic',
                'access_token' => $account->access_token,
            ]);

            if ($res->successful()) {
                $data = $res->json();
                $resolvedName = trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? ''));
                if (empty($resolvedName) && ! empty($data['name'])) {
                    $resolvedName = trim($data['name']);
                }
                $pic = $data['profile_pic'] ?? null;

                if (! empty($resolvedName) && ! str_starts_with($resolvedName, 'Facebook')) {
                    self::applyName($customer, $senderPsid, $resolvedName, $pic);
                    return $resolvedName;
                }
            }
        } catch (\Throwable $e) {
            // Ignore
        }

        // 4. Picture-specific lookup if customer lacks real profile picture
        if ($customer && (empty($customer->avatar_url) || str_contains($customer->avatar_url, 'unsplash.com'))) {
            try {
                $picRes = Http::timeout(3.0)->get("https://graph.facebook.com/{$version}/{$senderPsid}/picture", [
                    'type' => 'large',
                    'redirect' => false,
                    'access_token' => $account->access_token,
                ]);
                if ($picRes->successful() && ! empty($picRes->json('data.url'))) {
                    $picUrl = $picRes->json('data.url');
                    $customer->update(['avatar_url' => $picUrl]);
                }
            } catch (\Throwable $e) {
                // Ignore
            }
        }

        return $customer?->name;
    }

    /**
     * Sync all recent conversations across all active Facebook pages to enrich customer names & profile pictures.
     */
    public static function syncAllPagesRecentConversations(): int
    {
        $accounts = SocialAccount::where('platform', 'facebook_page')->where('is_active', true)->get();
        $updatedCount = 0;
        $version = config('services.meta.graph_version', 'v19.0');

        foreach ($accounts as $acc) {
            $token = $acc->access_token;
            if (! $token || str_starts_with($token, 'EAAXMOCK')) {
                continue;
            }

            try {
                $res = Http::timeout(8.0)->get("https://graph.facebook.com/{$version}/{$acc->account_id}/conversations", [
                    'fields' => 'id,participants{id,name,picture}',
                    'access_token' => $token,
                    'limit' => 35,
                ]);

                if (! $res->successful()) {
                    continue;
                }

                $conversations = $res->json('data') ?? [];
                foreach ($conversations as $conv) {
                    $participants = $conv['participants']['data'] ?? [];
                    foreach ($participants as $p) {
                        $psid = (string) ($p['id'] ?? '');
                        $name = trim($p['name'] ?? '');
                        $picture = $p['picture']['data']['url'] ?? null;

                        if (! $psid || $psid === (string) $acc->account_id) {
                            continue;
                        }

                        $identities = CustomerChannelIdentity::where('platform_customer_id', $psid)->get();
                        foreach ($identities as $ident) {
                            $cust = $ident->customer;
                            if ($cust) {
                                $up = [];
                                if (! empty($name) && ! str_starts_with($name, 'Facebook') && (str_starts_with($cust->name, 'Facebook') || empty($cust->name))) {
                                    $up['name'] = $name;
                                    $ident->update(['profile_name' => $name]);
                                }
                                if ($picture && (empty($cust->avatar_url) || str_contains($cust->avatar_url, 'unsplash.com'))) {
                                    $up['avatar_url'] = $picture;
                                }
                                if (! empty($up)) {
                                    $cust->update($up);
                                    $updatedCount++;
                                }
                            }
                        }
                    }
                }
            } catch (\Throwable $e) {
                Log::warning("syncAllPagesRecentConversations error for account {$acc->id}: " . $e->getMessage());
            }
        }

        return $updatedCount;
    }

    protected static function applyName(?Customer $customer, string $senderPsid, string $name, ?string $avatar = null): void
    {
        if ($customer) {
            $updates = [];
            if (! empty($name) && ! str_starts_with($name, 'Facebook Customer')) {
                $updates['name'] = $name;
            }
            if ($avatar && ! str_contains($avatar, 'unsplash.com')) {
                $localAvatar = self::downloadAndSaveAvatar($customer->id, $avatar);
                $updates['avatar_url'] = $localAvatar ?: $avatar;
            }
            if (! empty($updates)) {
                $customer->update($updates);
            }
        }

        CustomerChannelIdentity::where('platform_customer_id', $senderPsid)
            ->update(['profile_name' => $name]);
    }

    public static function downloadAndSaveAvatar(int $customerId, string $url): ?string
    {
        if (str_starts_with($url, '/uploads/avatars/')) {
            return $url;
        }

        try {
            $destDir = public_path('uploads/avatars');
            if (! file_exists($destDir)) {
                @mkdir($destDir, 0755, true);
            }

            $res = Http::timeout(8)->get($url);
            if ($res->successful() && strlen($res->body()) > 500) {
                $filename = "cust_{$customerId}_" . time() . ".jpg";
                file_put_contents($destDir . DIRECTORY_SEPARATOR . $filename, $res->body());
                return "/uploads/avatars/{$filename}";
            }
        } catch (\Throwable $e) {
            Log::warning("downloadAndSaveAvatar failed for customer {$customerId}: " . $e->getMessage());
        }

        return null;
    }
}

