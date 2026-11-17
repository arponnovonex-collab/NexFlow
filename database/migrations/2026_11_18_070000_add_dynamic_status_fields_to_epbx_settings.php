<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('epbx_settings')) {
            Schema::table('epbx_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('epbx_settings', 'order_call_key_1_status')) {
                    $table->string('order_call_key_1_status', 30)->default('confirmed')->after('order_call_key_1_action');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_key_1_wc_status')) {
                    $table->string('order_call_key_1_wc_status', 30)->default('processing')->after('order_call_key_1_status');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_key_2_status')) {
                    $table->string('order_call_key_2_status', 30)->default('cancelled')->after('order_call_key_2_action');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_key_2_wc_status')) {
                    $table->string('order_call_key_2_wc_status', 30)->default('cancelled')->after('order_call_key_2_status');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_no_answer_status')) {
                    $table->string('order_call_no_answer_status', 30)->default('pending_confirmation')->after('order_call_key_2_wc_status');
                }
                if (! Schema::hasColumn('epbx_settings', 'auto_call_max_retries')) {
                    $table->unsignedInteger('auto_call_max_retries')->default(2)->after('order_call_no_answer_status');
                }
                if (! Schema::hasColumn('epbx_settings', 'auto_call_orders_trigger')) {
                    $table->string('auto_call_orders_trigger', 30)->default('auto_on_order')->after('auto_call_orders_enabled');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('epbx_settings')) {
            Schema::table('epbx_settings', function (Blueprint $table) {
                $columns = [
                    'order_call_key_1_status',
                    'order_call_key_1_wc_status',
                    'order_call_key_2_status',
                    'order_call_key_2_wc_status',
                    'order_call_no_answer_status',
                    'auto_call_max_retries',
                    'auto_call_orders_trigger',
                ];
                foreach ($columns as $col) {
                    if (Schema::hasColumn('epbx_settings', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
