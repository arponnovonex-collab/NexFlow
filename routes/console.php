<?php

use App\Services\WooCommerceService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('woocommerce:sync-orders {--pages=1}', function () {
    $pages = (int) ($this->option('pages') ?: 1);
    $this->info("Starting automatic WooCommerce orders sync (pages: {$pages})...");
    try {
        $service = app(WooCommerceService::class);
        $result = $service->syncOrders($pages);
        $this->info("WooCommerce sync completed: {$result['synced_count']} orders synced.");
    } catch (\Throwable $e) {
        $this->error("WooCommerce sync error: " . $e->getMessage());
    }
})->purpose('Automatically sync latest WooCommerce orders into NexFlow');

// Schedule automatic background order synchronization
Schedule::command('woocommerce:sync-orders --pages=1')->everyMinute()->withoutOverlapping();
