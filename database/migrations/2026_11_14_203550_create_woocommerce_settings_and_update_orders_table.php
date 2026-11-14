<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create woocommerce_settings table
        if (! Schema::hasTable('woocommerce_settings')) {
            Schema::create('woocommerce_settings', function (Blueprint $table) {
                $table->id();
                $table->string('store_url')->nullable();
                $table->string('consumer_key')->nullable();
                $table->string('consumer_secret')->nullable();
                $table->boolean('is_enabled')->default(false);
                $table->boolean('auto_sync_orders')->default(true);
                $table->string('webhook_secret')->nullable();
                $table->timestamp('last_synced_at')->nullable();
                $table->string('sync_status', 50)->default('idle');
                $table->text('last_error')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        // 2. Enhance orders table for WooCommerce support
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'wc_order_id')) {
                $table->unsignedBigInteger('wc_order_id')->nullable()->unique()->after('order_number');
            }
            if (! Schema::hasColumn('orders', 'items_data')) {
                $table->json('items_data')->nullable()->after('quantity');
            }
            if (! Schema::hasColumn('orders', 'payment_method_title')) {
                $table->string('payment_method_title')->nullable()->after('payment_status');
            }
            if (! Schema::hasColumn('orders', 'shipping_method_title')) {
                $table->string('shipping_method_title')->nullable()->after('payment_method_title');
            }
            if (! Schema::hasColumn('orders', 'wc_raw_data')) {
                $table->longText('wc_raw_data')->nullable()->after('courier_response');
            }
        });

        // Change order_source to varchar(50) so it accepts 'woocommerce', 'web', 'manual_inbox', etc.
        try {
            DB::statement("ALTER TABLE `orders` MODIFY COLUMN `order_source` VARCHAR(50) NOT NULL DEFAULT 'manual_inbox'");
        } catch (\Throwable $e) {
            // Ignore if already modified
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('woocommerce_settings');

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'wc_order_id')) {
                $table->dropColumn('wc_order_id');
            }
            if (Schema::hasColumn('orders', 'items_data')) {
                $table->dropColumn('items_data');
            }
            if (Schema::hasColumn('orders', 'payment_method_title')) {
                $table->dropColumn('payment_method_title');
            }
            if (Schema::hasColumn('orders', 'shipping_method_title')) {
                $table->dropColumn('shipping_method_title');
            }
            if (Schema::hasColumn('orders', 'wc_raw_data')) {
                $table->dropColumn('wc_raw_data');
            }
        });
    }
};
