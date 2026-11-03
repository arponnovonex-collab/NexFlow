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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('avatar_url')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['email', 'phone']);
        });

        Schema::create('customer_channel_identities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->onDelete('cascade');
            $table->foreignId('social_account_id')->constrained('social_accounts')->onDelete('cascade');
            $table->enum('platform', ['facebook_page', 'instagram_business', 'whatsapp_cloud']);
            $table->string('platform_customer_id')->index(); // PSID, IGSID, or Phone number
            $table->string('profile_name')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['social_account_id', 'platform', 'platform_customer_id'], 'channel_identity_unique');
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_account_id')->constrained('social_accounts')->onDelete('cascade');
            $table->foreignId('customer_id')->constrained('customers')->onDelete('cascade');
            $table->enum('platform', ['facebook_page', 'instagram_business', 'whatsapp_cloud']);
            $table->string('channel_conversation_id')->nullable()->index();
            $table->enum('status', ['pending', 'active', 'resolved'])->default('pending');
            $table->enum('ai_mode', ['auto', 'suggestion_only', 'human_only'])->default('auto');
            $table->boolean('is_human_takeover')->default(false);
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable()->index();
            $table->integer('unread_count')->default(0);
            $table->enum('priority', ['normal', 'urgent'])->default('normal');
            $table->timestamps();

            $table->index(['status', 'assigned_to_user_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->onDelete('cascade');
            $table->enum('sender_type', ['customer', 'moderator', 'ai', 'system']);
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('platform_message_id')->nullable()->index();
            $table->text('text')->nullable();
            $table->string('message_type', 50)->default('text'); // text, image, audio, video, document, template
            $table->json('payload')->nullable();
            $table->enum('delivery_status', ['pending', 'sent', 'delivered', 'read', 'failed'])->default('pending');
            $table->boolean('is_internal_note')->default(false);
            $table->timestamp('sent_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
        });

        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('messages')->onDelete('cascade');
            $table->text('file_url');
            $table->string('file_type', 50)->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->timestamps();
        });

        Schema::create('conversation_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->text('note');
            $table->timestamps();
        });

        Schema::create('conversation_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->onDelete('cascade');
            $table->string('tag', 50)->index();
            $table->timestamps();

            $table->unique(['conversation_id', 'tag']);
        });

        Schema::create('social_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->onDelete('cascade');
            $table->string('platform_comment_id')->index();
            $table->string('parent_comment_id')->nullable()->index();
            $table->string('customer_name')->nullable();
            $table->string('platform_user_id')->nullable()->index();
            $table->text('message');
            $table->string('intent', 50)->nullable(); // price_inquiry, size_inquiry, etc.
            $table->string('sentiment', 20)->nullable(); // positive, neutral, negative
            $table->enum('reply_status', ['unanswered', 'replied', 'ignored', 'requires_approval'])->default('unanswered');
            $table->text('reply_text')->nullable();
            $table->boolean('is_page_owned')->default(false);
            $table->timestamps();

            $table->unique(['social_post_id', 'platform_comment_id']);
        });

        Schema::create('comment_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_comment_id')->constrained('social_comments')->onDelete('cascade');
            $table->text('reply_text');
            $table->enum('sender_type', ['ai', 'moderator'])->default('ai');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('platform_reply_id')->nullable()->index();
            $table->enum('status', ['draft', 'approved', 'published', 'failed'])->default('published');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('comment_replies');
        Schema::dropIfExists('social_comments');
        Schema::dropIfExists('conversation_tags');
        Schema::dropIfExists('conversation_notes');
        Schema::dropIfExists('message_attachments');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('customer_channel_identities');
        Schema::dropIfExists('customers');
    }
};

