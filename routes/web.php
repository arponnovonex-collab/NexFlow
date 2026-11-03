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

/*
|--------------------------------------------------------------------------
| Web Routes - SPA Catch-All
|--------------------------------------------------------------------------
*/
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api|webhook).*$');

