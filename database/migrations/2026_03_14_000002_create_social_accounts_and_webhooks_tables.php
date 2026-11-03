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
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->enum('platform', ['facebook_page', 'instagram_business', 'whatsapp_cloud']);
            $table->string('account_id')->index(); // Page ID, IG ID, or Phone Number ID
            $table->string('name');
            $table->string('username')->nullable();
            $table->text('profile_picture_url')->nullable();
            $table->longText('access_token'); // Encrypted
            $table->longText('refresh_token')->nullable(); // Encrypted
            $table->timestamp('token_expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->enum('status', ['connected', 'disconnected', 'expired', 'error'])->default('connected');
            $table->json('permissions')->nullable();
            $table->boolean('webhook_verified')->default(false);
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->json('settings')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['platform', 'account_id']);
        });

        Schema::create('social_account_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_account_id')->constrained('social_accounts')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['social_account_id', 'user_id']);
        });

        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 50)->index();
            $table->string('event_id')->nullable()->index();
            $table->string('event_type', 100)->index();
            $table->json('payload');
            $table->boolean('processed')->default(false)->index();
            $table->timestamp('processed_at')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('webhook_events');
        Schema::dropIfExists('social_account_assignments');
        Schema::dropIfExists('social_accounts');
    }
};

