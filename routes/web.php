<?php

use Illuminate\Support\Facades\Route;

Route::get('/setup-env-nexflow-init-2026', function () {
    $envContent = <<<'ENV'
APP_NAME=NexFlow
APP_ENV=production
APP_KEY=base64:N4QrQCzywsgpFnwwJzEPczAFxVEoVaTKDx4FAv3szcU=
APP_DEBUG=false
APP_TIMEZONE=Asia/Dhaka
APP_URL=https://nexflow.auliro.xyz

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=u846714667_nexflow
DB_USERNAME=u846714667_nexflow
DB_PASSWORD="NexFlow@2026#SecDb9"

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=database
CACHE_PREFIX=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=nexflow_secure_webhook_token_2026
ENV;

    file_put_contents(base_path('.env'), $envContent);
    \Illuminate\Support\Facades\Artisan::call('config:clear');
    \Illuminate\Support\Facades\Artisan::call('cache:clear');
    
    $dbStatus = 'unknown';
    try {
        $userCount = \App\Models\User::count();
        $dbStatus = "Connected! Users count: " . $userCount;
    } catch (\Throwable $e) {
        $dbStatus = "Error: " . $e->getMessage();
    }

    return response()->json([
        'status' => 'success',
        'env_written' => file_exists(base_path('.env')),
        'db_status' => $dbStatus,
    ]);
});

Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api|webhook|setup-env).*$');
