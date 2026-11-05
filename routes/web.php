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
    $customers = \App\Models\Customer::select('id', 'name', 'avatar_url')->take(10)->get();
    $activeAccount = \App\Models\SocialAccount::where('is_active', true)->first();
    $firstConv = \App\Models\Conversation::with('customer')->first();
    
    $fbTest = null;
    if ($activeAccount && $firstConv) {
        $psid = preg_replace('/^t_(?:ig_|wa_)?/', '', $firstConv->channel_conversation_id);
        $version = config('services.meta.graph_version', 'v19.0');
        
        $psidRes = \Illuminate\Support\Facades\Http::timeout(5)->get("https://graph.facebook.com/{$version}/{$psid}", [
            'fields' => 'name,first_name,last_name,profile_pic',
            'access_token' => $activeAccount->access_token,
        ]);
        
        $picEndpointRes = \Illuminate\Support\Facades\Http::timeout(5)->get("https://graph.facebook.com/{$version}/{$psid}/picture", [
            'type' => 'large',
            'redirect' => false,
            'access_token' => $activeAccount->access_token,
        ]);

        $convRes = \Illuminate\Support\Facades\Http::timeout(5)->get("https://graph.facebook.com/{$version}/{$activeAccount->account_id}/conversations", [
            'fields' => 'id,participants{id,name,picture}',
            'access_token' => $activeAccount->access_token,
            'limit' => 3,
        ]);

        $fbTest = [
            'account_id' => $activeAccount->account_id,
            'psid' => $psid,
            'user_endpoint_status' => $psidRes->status(),
            'user_endpoint_body' => $psidRes->json(),
            'pic_endpoint_status' => $picEndpointRes->status(),
            'pic_endpoint_body' => $picEndpointRes->json(),
            'conv_endpoint_status' => $convRes->status(),
            'conv_endpoint_body' => $convRes->json(),
        ];
    }

    return response()->json([
        'status' => 'success',
        'view_cleared' => true,
        'composer_lock_deleted' => $lockDeleted,
        'conversations_count' => $convCount,
        'messages_count' => $msgCount,
        'customers' => $customers,
        'fb_test' => $fbTest,
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

