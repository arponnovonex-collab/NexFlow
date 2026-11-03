<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Auto-provision .env on first run if missing or incomplete
$envFile = __DIR__ . '/.env';
if (!file_exists($envFile) || filesize($envFile) < 50) {
    @file_put_contents($envFile, implode("\n", [
        'APP_NAME=NexFlow',
        'APP_ENV=production',
        'APP_KEY=base64:N4QrQCzywsgpFnwwJzEPczAFxVEoVaTKDx4FAv3szcU=',
        'APP_DEBUG=false',
        'APP_TIMEZONE=Asia/Dhaka',
        'APP_URL=https://nexflow.auliro.xyz',
        'APP_LOCALE=en',
        'APP_FALLBACK_LOCALE=en',
        'APP_FAKER_LOCALE=en_US',
        'APP_MAINTENANCE_DRIVER=file',
        'LOG_CHANNEL=stack',
        'LOG_STACK=single',
        'LOG_DEPRECATIONS_CHANNEL=null',
        'LOG_LEVEL=error',
        'DB_CONNECTION=mysql',
        'DB_HOST=127.0.0.1',
        'DB_PORT=3306',
        'DB_DATABASE=u846714667_nexflow',
        'DB_USERNAME=u846714667_nexflow',
        'DB_PASSWORD="NexFlow@2026#SecDb9"',
        'SESSION_DRIVER=database',
        'SESSION_LIFETIME=120',
        'SESSION_ENCRYPT=false',
        'SESSION_PATH=/',
        'SESSION_DOMAIN=null',
        'BROADCAST_CONNECTION=log',
        'FILESYSTEM_DISK=local',
        'QUEUE_CONNECTION=database',
        'CACHE_STORE=database',
        'CACHE_PREFIX=',
        'OPENAI_API_KEY=',
        'OPENAI_MODEL=gpt-4o-mini',
        'META_APP_ID=',
        'META_APP_SECRET=',
        'META_WEBHOOK_VERIFY_TOKEN=nexflow_secure_webhook_token_2026',
        '',
    ]));
}

// Ensure critical variables are set even if .env was cached
if (!getenv('APP_KEY')) {
    putenv('APP_KEY=base64:N4QrQCzywsgpFnwwJzEPczAFxVEoVaTKDx4FAv3szcU=');
    $_ENV['APP_KEY'] = 'base64:N4QrQCzywsgpFnwwJzEPczAFxVEoVaTKDx4FAv3szcU=';
    $_SERVER['APP_KEY'] = 'base64:N4QrQCzywsgpFnwwJzEPczAFxVEoVaTKDx4FAv3szcU=';
}
if (!getenv('DB_DATABASE')) {
    putenv('DB_CONNECTION=mysql');
    putenv('DB_HOST=127.0.0.1');
    putenv('DB_PORT=3306');
    putenv('DB_DATABASE=u846714667_nexflow');
    putenv('DB_USERNAME=u846714667_nexflow');
    putenv('DB_PASSWORD=NexFlow@2026#SecDb9');
    $_ENV['DB_CONNECTION'] = 'mysql';
    $_ENV['DB_HOST'] = '127.0.0.1';
    $_ENV['DB_PORT'] = '3306';
    $_ENV['DB_DATABASE'] = 'u846714667_nexflow';
    $_ENV['DB_USERNAME'] = 'u846714667_nexflow';
    $_ENV['DB_PASSWORD'] = 'NexFlow@2026#SecDb9';
}

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
