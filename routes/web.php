<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Compliance Pages (Meta App Review & Legal)
|--------------------------------------------------------------------------
*/
Route::get('/privacy-policy', function () {
    return view('privacy-policy');
});

Route::get('/terms-of-service', function () {
    return view('terms-of-service');
});

Route::get('/data-deletion', function () {
    return view('data-deletion');
});

Route::get('/login', function () {
    return view('app');
})->name('login');

/*
|--------------------------------------------------------------------------
| System Maintenance & Cache Invalidation
|--------------------------------------------------------------------------
*/
Route::get('/maintenance/clear-cache', function () {
    \Illuminate\Support\Facades\Artisan::call('view:clear');
    \Illuminate\Support\Facades\Artisan::call('cache:clear');
    \Illuminate\Support\Facades\Artisan::call('config:clear');
    \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
    $lockFile = base_path('composer.lock');
    $lockDeleted = false;
    if (file_exists($lockFile)) {
        $lockDeleted = @unlink($lockFile);
    }

    // Ensure Super Admin Tanjimur Rahman Arpon is active and protected
    $superAdmin = \App\Models\User::where('email', 'atanjimurrahman@gmail.com')->first();
    if (! $superAdmin) {
        $oldAdmin = \App\Models\User::where('email', 'admin@nexflow.ai')
            ->orWhere('role', 'super_admin')
            ->first();

        if ($oldAdmin) {
            $oldAdmin->update([
                'name' => 'Tanjimur Rahman Arpon',
                'email' => 'atanjimurrahman@gmail.com',
                'phone' => '01580401289',
                'role' => 'super_admin',
                'status' => 'active',
            ]);
            $superAdmin = $oldAdmin;
        } else {
            $superAdmin = \App\Models\User::create([
                'name' => 'Tanjimur Rahman Arpon',
                'email' => 'atanjimurrahman@gmail.com',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'phone' => '01580401289',
                'role' => 'super_admin',
                'status' => 'active',
            ]);
        }
    } else {
        $superAdmin->update([
            'name' => 'Tanjimur Rahman Arpon',
            'phone' => '01580401289',
            'role' => 'super_admin',
            'status' => 'active',
        ]);
    }

    $convCount = \App\Models\Conversation::count();
    $msgCount = \App\Models\Message::count();

    // Debug: test customer avatars in DB and Facebook API response
    // Avatar Download & Local Caching Utility
    $avatarsDir = public_path('uploads/avatars');
    if (! file_exists($avatarsDir)) {
        @mkdir($avatarsDir, 0755, true);
    }

    $downloadedCount = 0;
    $allCustomers = \App\Models\Customer::all();

    foreach ($allCustomers as $c) {
        $url = $c->avatar_url;
        // If already local file, skip
        if ($url && str_starts_with($url, '/uploads/avatars/')) {
            continue;
        }

        // If it's a real Facebook / Meta image URL
        if ($url && (str_contains($url, 'platform-lookaside.fbsbx.com') || str_contains($url, 'fbcdn.net') || str_contains($url, 'cdninstagram.com'))) {
            try {
                $imgRes = \Illuminate\Support\Facades\Http::timeout(10)->get($url);
                if ($imgRes->successful() && strlen($imgRes->body()) > 500) {
                    $filename = "cust_{$c->id}_" . time() . ".jpg";
                    file_put_contents($avatarsDir . DIRECTORY_SEPARATOR . $filename, $imgRes->body());
                    $localUrl = "/uploads/avatars/{$filename}";
                    $c->update(['avatar_url' => $localUrl]);
                    $downloadedCount++;
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Failed to download avatar for cust {$c->id}: " . $e->getMessage());
            }
        } elseif ($url && str_contains($url, 'unsplash.com')) {
            // Clean out legacy unsplash mock avatars
            $c->update(['avatar_url' => null]);
        }
    }

    // Now check all active Facebook conversations and fetch profile pictures for any customer missing avatar
    $activeAccounts = \App\Models\SocialAccount::where('is_active', true)->get();
    foreach ($activeAccounts as $acc) {
        $token = $acc->access_token;
        if (! $token || str_starts_with($token, 'EAAXMOCK')) continue;
        $version = config('services.meta.graph_version', 'v19.0');

        $convs = \App\Models\Conversation::where('social_account_id', $acc->id)->with('customer')->get();
        foreach ($convs as $conv) {
            $cust = $conv->customer;
            if (! $cust || ($cust->avatar_url && str_starts_with($cust->avatar_url, '/uploads/avatars/'))) {
                continue;
            }

            $psid = preg_replace('/^t_(?:ig_|wa_)?/', '', $conv->channel_conversation_id);
            if (! $psid) continue;

            try {
                $res = \Illuminate\Support\Facades\Http::timeout(4)->get("https://graph.facebook.com/{$version}/{$psid}", [
                    'fields' => 'name,first_name,last_name,profile_pic',
                    'access_token' => $token,
                ]);

                if ($res->successful()) {
                    $pData = $res->json();
                    $pic = $pData['profile_pic'] ?? null;
                    if ($pic) {
                        $imgRes = \Illuminate\Support\Facades\Http::timeout(10)->get($pic);
                        if ($imgRes->successful() && strlen($imgRes->body()) > 500) {
                            $filename = "cust_{$cust->id}_" . time() . ".jpg";
                            file_put_contents($avatarsDir . DIRECTORY_SEPARATOR . $filename, $imgRes->body());
                            $cust->update([
                                'avatar_url' => "/uploads/avatars/{$filename}",
                                'name' => ! empty($pData['name']) ? $pData['name'] : $cust->name,
                            ]);
                            $downloadedCount++;
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }
    }

    $updatedCustomers = \App\Models\Customer::select('id', 'name', 'avatar_url')->get();

    return response()->json([
        'status' => 'success',
        'view_cleared' => true,
        'composer_lock_deleted' => $lockDeleted,
        'downloaded_avatars_count' => $downloadedCount,
        'customers' => $updatedCustomers,
        'super_admin' => [
            'id' => $superAdmin->id,
            'name' => $superAdmin->name,
            'email' => $superAdmin->email,
            'phone' => $superAdmin->phone,
            'role' => $superAdmin->role,
            'status' => $superAdmin->status,
        ],
    ]);
});

/*
|--------------------------------------------------------------------------
| Web Routes - SPA Catch-All
|--------------------------------------------------------------------------
*/
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api|webhook).*$');

