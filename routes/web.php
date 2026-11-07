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

    // Automatically re-subscribe active Facebook Pages to Meta Webhooks including message_echoes
    $subscribedPages = [];
    $fbAccounts = \App\Models\SocialAccount::where('platform', 'facebook_page')
        ->where('status', 'connected')
        ->where('is_active', true)
        ->get();

    $version = config('services.meta.graph_version', 'v19.0');
    foreach ($fbAccounts as $fbAcc) {
        if (! empty($fbAcc->access_token) && ! str_starts_with($fbAcc->access_token, 'EAAXMOCK')) {
            try {
                $subRes = \Illuminate\Support\Facades\Http::timeout(6)->post("https://graph.facebook.com/{$version}/{$fbAcc->account_id}/subscribed_apps", [
                    'subscribed_fields' => 'feed,messages,messaging_postbacks,message_echoes',
                    'access_token' => $fbAcc->access_token,
                ]);
                $subscribedPages[$fbAcc->name] = $subRes->successful();
            } catch (\Throwable $e) {
                $subscribedPages[$fbAcc->name] = false;
            }
        }
    }

    return response()->json([
        'status' => 'success',
        'view_cleared' => true,
        'composer_lock_deleted' => $lockDeleted,
        'conversations_count' => $convCount,
        'messages_count' => $msgCount,
        'subscribed_pages' => $subscribedPages,
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

