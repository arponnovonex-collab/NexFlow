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
        Schema::create('sms_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('bulksmsbd');
            $table->text('api_key')->nullable();
            $table->string('sender_id')->nullable();
            $table->boolean('is_enabled')->default(false);
            $table->boolean('auto_sms_enabled')->default(true);
            $table->text('auto_sms_template')->nullable();
            $table->decimal('last_balance', 10, 2)->nullable();
            $table->timestamp('last_balance_checked_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('sms_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('message');
            $table->string('target_type')->default('all_customers'); // all_customers, product_buyers
            $table->foreignId('target_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->integer('recipient_count')->default(0);
            $table->integer('sent_count')->default(0);
            $table->integer('failed_count')->default(0);
            $table->enum('status', ['draft', 'sending', 'completed', 'failed'])->default('completed');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('sms_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->nullable()->constrained('sms_campaigns')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('phone_number');
            $table->text('message');
            $table->string('type')->default('auto_order'); // auto_order, marketing, test, manual
            $table->string('status')->default('sent'); // sent, failed
            $table->string('response_code')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['type', 'status', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sms_logs');
        Schema::dropIfExists('sms_campaigns');
        Schema::dropIfExists('sms_settings');
    }
};

