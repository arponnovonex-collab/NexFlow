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
        Schema::create('ai_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_suggestions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('suggested_text');
            $table->string('intent', 50)->nullable();
            $table->decimal('confidence', 5, 2)->nullable();
            $table->string('tone', 50)->default('friendly');
            $table->boolean('is_applied')->default(false);
            $table->text('edited_text')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->string('context_type', 50); // comment_reply, message_reply, suggestion, lead_classification
            $table->string('model', 50);
            $table->integer('prompt_tokens')->default(0);
            $table->integer('completion_tokens')->default(0);
            $table->integer('total_tokens')->default(0);
            $table->decimal('estimated_cost', 8, 5)->default(0.00000);
            $table->json('response_payload')->nullable();
            $table->timestamps();

            $table->index(['context_type', 'created_at']);
        });

        Schema::create('automation_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('scope', ['global', 'facebook', 'instagram', 'whatsapp', 'page', 'post'])->default('global');
            $table->foreignId('social_account_id')->nullable()->constrained('social_accounts')->nullOnDelete();
            $table->string('condition_type', 50); // keyword, intent, time, missing_product, human_requested
            $table->json('condition_payload')->nullable();
            $table->string('action_type', 50); // auto_reply, suggest_only, stop_automation, assign_moderator, mark_hot_lead
            $table->json('action_payload')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0);
            $table->timestamps();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100);
            $table->string('entity_type', 100)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->text('description')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['action', 'created_at']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->text('message');
            $table->string('type', 50)->default('info'); // info, warning, urgent, success
            $table->boolean('is_read')->default(false);
            $table->string('link')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read']);
        });

        Schema::create('integration_errors', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 50)->index();
            $table->string('endpoint')->nullable();
            $table->text('error_message');
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->boolean('resolved')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('integration_errors');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('automation_rules');
        Schema::dropIfExists('ai_usage_logs');
        Schema::dropIfExists('ai_suggestions');
        Schema::dropIfExists('ai_settings');
    }
};

