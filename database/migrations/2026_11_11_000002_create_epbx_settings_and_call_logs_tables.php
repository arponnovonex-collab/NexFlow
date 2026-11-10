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
        if (! Schema::hasTable('epbx_settings')) {
            Schema::create('epbx_settings', function (Blueprint $table) {
                $table->id();
                $table->string('provider', 50)->default('epbx_bd');
                $table->string('api_base_url', 255)->default('https://epbx.bd/api/v1');
                $table->text('api_token')->nullable();
                $table->string('trunk_number', 50)->nullable();
                $table->string('default_extension', 20)->nullable();
                $table->string('webhook_secret', 100)->nullable();
                $table->boolean('is_enabled')->default(false);
                $table->decimal('last_balance', 10, 2)->nullable();
                $table->timestamp('last_checked_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('call_logs')) {
            Schema::create('call_logs', function (Blueprint $table) {
                $table->id();
                $table->string('call_session_id', 100)->nullable()->unique();
                $table->enum('direction', ['outbound', 'inbound'])->default('outbound');
                $table->string('customer_phone', 30);
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->foreignId('agent_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('agent_extension', 20)->default('101');
                $table->string('trunk_number', 50)->nullable();
                $table->enum('status', ['initiated', 'ringing', 'answered', 'busy', 'no_answer', 'failed'])->default('initiated');
                $table->unsignedInteger('duration_seconds')->default(0);
                $table->string('recording_url', 500)->nullable();
                $table->decimal('cost', 8, 2)->default(0.00);
                $table->string('disposition', 50)->nullable();
                $table->text('notes')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('answered_at')->nullable();
                $table->timestamp('ended_at')->nullable();
                $table->timestamps();

                $table->index('customer_phone');
                $table->index('agent_user_id');
                $table->index('status');
                $table->index('created_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('call_logs');
        Schema::dropIfExists('epbx_settings');
    }
};

