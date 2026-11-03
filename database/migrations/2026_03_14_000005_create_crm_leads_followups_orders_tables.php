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
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->onDelete('cascade');
            $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['cold', 'warm', 'hot', 'converted', 'lost'])->default('cold');
            $table->string('suggested_status', 20)->nullable();
            $table->decimal('confidence', 5, 2)->nullable();
            $table->foreignId('related_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->timestamp('last_status_change_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'assigned_to_user_id']);
        });

        Schema::create('lead_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained('leads')->onDelete('cascade');
            $table->string('previous_status', 20)->nullable();
            $table->string('new_status', 20);
            $table->foreignId('changed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('source', ['manual', 'ai', 'system'])->default('manual');
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_followups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained('leads')->onDelete('cascade');
            $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->date('followup_date');
            $table->time('followup_time')->nullable();
            $table->text('notes')->nullable();
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium');
            $table->enum('status', ['scheduled', 'due_today', 'overdue', 'completed', 'cancelled'])->default('scheduled');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['followup_date', 'status', 'user_id']);
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('customer_id')->constrained('customers')->onDelete('cascade');
            $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('delivery_charge', 8, 2)->default(0.00);
            $table->decimal('total_amount', 10, 2);
            $table->enum('order_status', ['draft', 'pending_confirmation', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])->default('draft');
            $table->enum('payment_status', ['unpaid', 'paid', 'refunded'])->default('unpaid');
            $table->enum('order_source', ['manual_inbox', 'web', 'import'])->default('manual_inbox');
            $table->text('customer_address')->nullable();
            $table->string('customer_phone')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['order_status', 'customer_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
        Schema::dropIfExists('lead_followups');
        Schema::dropIfExists('lead_status_histories');
        Schema::dropIfExists('leads');
    }
};

