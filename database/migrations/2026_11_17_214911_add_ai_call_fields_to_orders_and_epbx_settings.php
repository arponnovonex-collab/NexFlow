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
        // 1. Add AI call fields to orders table
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (! Schema::hasColumn('orders', 'ai_call_status')) {
                    $table->string('ai_call_status', 30)->default('idle')->after('order_status');
                }
                if (! Schema::hasColumn('orders', 'ai_call_session_id')) {
                    $table->string('ai_call_session_id', 100)->nullable()->after('ai_call_status');
                }
                if (! Schema::hasColumn('orders', 'ai_call_count')) {
                    $table->unsignedInteger('ai_call_count')->default(0)->after('ai_call_session_id');
                }
                if (! Schema::hasColumn('orders', 'ai_call_last_at')) {
                    $table->timestamp('ai_call_last_at')->nullable()->after('ai_call_count');
                }
                if (! Schema::hasColumn('orders', 'ai_call_recording_url')) {
                    $table->string('ai_call_recording_url', 500)->nullable()->after('ai_call_last_at');
                }
                if (! Schema::hasColumn('orders', 'ai_call_notes')) {
                    $table->text('ai_call_notes')->nullable()->after('ai_call_recording_url');
                }
            });
        }

        // 2. Add AI order call configuration to epbx_settings table
        if (Schema::hasTable('epbx_settings')) {
            Schema::table('epbx_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('epbx_settings', 'auto_call_orders_enabled')) {
                    $table->boolean('auto_call_orders_enabled')->default(false)->after('is_enabled');
                }
                if (! Schema::hasColumn('epbx_settings', 'auto_call_delay_seconds')) {
                    $table->unsignedInteger('auto_call_delay_seconds')->default(60)->after('auto_call_orders_enabled');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_custom_text')) {
                    $table->text('order_call_custom_text')->nullable()->after('auto_call_delay_seconds');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_confirm_text')) {
                    $table->text('order_call_confirm_text')->nullable()->after('order_call_custom_text');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_cancel_text')) {
                    $table->text('order_call_cancel_text')->nullable()->after('order_call_confirm_text');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_key_1_action')) {
                    $table->string('order_call_key_1_action', 30)->default('hangup')->after('order_call_cancel_text');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_key_2_action')) {
                    $table->string('order_call_key_2_action', 30)->default('hangup')->after('order_call_key_1_action');
                }
                if (! Schema::hasColumn('epbx_settings', 'order_call_agent_extension')) {
                    $table->string('order_call_agent_extension', 20)->nullable()->after('order_call_key_2_action');
                }
            });
        }

        // 3. Link call_logs with order_id
        if (Schema::hasTable('call_logs')) {
            Schema::table('call_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('call_logs', 'order_id')) {
                    $table->foreignId('order_id')->nullable()->after('customer_id')->constrained('orders')->nullOnDelete();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                $columns = ['ai_call_status', 'ai_call_session_id', 'ai_call_count', 'ai_call_last_at', 'ai_call_recording_url', 'ai_call_notes'];
                foreach ($columns as $col) {
                    if (Schema::hasColumn('orders', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('epbx_settings')) {
            Schema::table('epbx_settings', function (Blueprint $table) {
                $columns = [
                    'auto_call_orders_enabled',
                    'auto_call_delay_seconds',
                    'order_call_custom_text',
                    'order_call_confirm_text',
                    'order_call_cancel_text',
                    'order_call_key_1_action',
                    'order_call_key_2_action',
                    'order_call_agent_extension',
                ];
                foreach ($columns as $col) {
                    if (Schema::hasColumn('epbx_settings', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('call_logs')) {
            Schema::table('call_logs', function (Blueprint $table) {
                if (Schema::hasColumn('call_logs', 'order_id')) {
                    $table->dropConstrainedForeignId('order_id');
                }
            });
        }
    }
};
