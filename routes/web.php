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
    $convs = \App\Models\Conversation::with(['customer', 'socialAccount'])->whereNotNull('customer_id')->get();
    $results = [];

    foreach ($convs as $c) {
        $acc = $c->socialAccount;
        if (! $acc || ! $acc->access_token || str_starts_with($acc->access_token, 'EAAXMOCK')) {
            continue;
        }

        $psid = preg_replace('/^t_(?:ig_|wa_)?/', '', $c->channel_conversation_id);
        $version = config('services.meta.graph_version', 'v19.0');

        // Test 1: Query User Profile API for PSID with page token
        $res1 = \Illuminate\Support\Facades\Http::timeout(3)->get("https://graph.facebook.com/{$version}/{$psid}", [
            'fields' => 'name,first_name,last_name,profile_pic',
            'access_token' => $acc->access_token,
        ]);

        // Test 2: Query Picture edge for PSID with page token
        $res2 = \Illuminate\Support\Facades\Http::timeout(3)->get("https://graph.facebook.com/{$version}/{$psid}/picture", [
            'type' => 'large',
            'redirect' => false,
            'access_token' => $acc->access_token,
        ]);

        $results[] = [
            'conv_id' => $c->id,
            'page_name' => $acc->name,
            'page_id' => $acc->account_id,
            'psid' => $psid,
            'customer_name' => $c->customer?->name,
            'current_avatar' => $c->customer?->avatar_url,
            'user_endpoint' => [
                'status' => $res1->status(),
                'body' => $res1->json(),
            ],
            'pic_endpoint' => [
                'status' => $res2->status(),
                'body' => $res2->json(),
            ],
        ];

        if (count($results) >= 4) break;
    }

    return response()->json([
        'status' => 'success',
        'view_cleared' => true,
        'results' => $results,
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

