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
     * Resolve and update customer real name using Page Conversations API, Comments, or Graph API.
     */
    public static function resolveCustomerName(?SocialAccount $account, string $senderPsid, ?Customer $customer = null): ?string
    {
        // 1. Check if user already commented on a Facebook post with their real name
        $commentName = SocialComment::where('platform_user_id', $senderPsid)
            ->whereNotNull('customer_name')
            ->where('customer_name', '!=', '')
            ->where('customer_name', 'not like', 'Facebook%')
            ->latest()
            ->value('customer_name');

        if (! empty($commentName)) {
            self::applyName($customer, $senderPsid, $commentName);
            return $commentName;
        }

        if (! $account || ! $account->access_token || str_starts_with($account->access_token, 'EAAXMOCK')) {
            return null;
        }

        $version = config('services.meta.graph_version', 'v19.0');

        // 2. High-success method: Fetch Page Conversations where participants contain real names!
        try {
            $convRes = Http::timeout(4.0)->get("https://graph.facebook.com/{$version}/{$account->account_id}/conversations", [
                'fields' => 'id,participants',
                'access_token' => $account->access_token,
                'limit' => 25,
            ]);

            if ($convRes->successful()) {
                $conversations = $convRes->json('data') ?? [];
                foreach ($conversations as $conv) {
                    $participants = $conv['participants']['data'] ?? [];
                    foreach ($participants as $p) {
                        $pId = (string) ($p['id'] ?? '');
                        $pName = trim($p['name'] ?? '');
                        if ($pId === (string) $senderPsid && ! empty($pName) && ! str_starts_with($pName, 'Facebook')) {
                            self::applyName($customer, $senderPsid, $pName);
                            return $pName;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning("FacebookProfileService conversations error for account {$account->id}: " . $e->getMessage());
        }

        // 3. Fallback: Direct PSID Graph API lookup (works for App Admins/Developers/Testers)
        try {
            $res = Http::timeout(2.5)->get("https://graph.facebook.com/{$version}/{$senderPsid}", [
                'fields' => 'name,first_name,last_name,profile_pic',
                'access_token' => $account->access_token,
            ]);

            if ($res->successful()) {
                $data = $res->json();
                $resolvedName = trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? ''));
                if (empty($resolvedName) && ! empty($data['name'])) {
                    $resolvedName = trim($data['name']);
                }

                if (! empty($resolvedName) && ! str_starts_with($resolvedName, 'Facebook')) {
                    self::applyName($customer, $senderPsid, $resolvedName, $data['profile_pic'] ?? null);
                    return $resolvedName;
                }
            }
        } catch (\Throwable $e) {
            // Ignore
        }

        return null;
    }

    /**
     * Sync all recent conversations across all active Facebook pages to enrich customer names.
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
                $res = Http::timeout(6.0)->get("https://graph.facebook.com/{$version}/{$acc->account_id}/conversations", [
                    'fields' => 'id,participants',
                    'access_token' => $token,
                    'limit' => 30,
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
                        if (! $psid || ! $name || $psid === (string) $acc->account_id || str_starts_with($name, 'Facebook')) {
                            continue;
                        }

                        $identities = CustomerChannelIdentity::where('platform_customer_id', $psid)->get();
                        foreach ($identities as $ident) {
                            if ($ident->customer && (str_starts_with($ident->customer->name, 'Facebook') || empty($ident->customer->name))) {
                                $ident->customer->update(['name' => $name]);
                                $ident->update(['profile_name' => $name]);
                                $updatedCount++;
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
            $updates = ['name' => $name];
            if ($avatar) {
                $updates['avatar_url'] = $avatar;
            }
            $customer->update($updates);
        }

        CustomerChannelIdentity::where('platform_customer_id', $senderPsid)
            ->update(['profile_name' => $name]);
    }
}

