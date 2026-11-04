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
    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
    $lockFile = base_path('composer.lock');
    $lockDeleted = false;
    if (file_exists($lockFile)) {
        $lockDeleted = @unlink($lockFile);
    }
    $convCount = \App\Models\Conversation::count();
    $msgCount = \App\Models\Message::count();
    return response()->json([
        'status' => 'success',
        'view_cleared' => true,
        'composer_lock_deleted' => $lockDeleted,
        'conversations_count' => $convCount,
        'messages_count' => $msgCount,
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

