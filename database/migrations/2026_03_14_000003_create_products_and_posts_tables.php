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
        Schema::create('product_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('name');
            $table->string('sku')->unique();
            $table->string('slug')->unique();
            $table->text('short_description')->nullable();
            $table->longText('full_description')->nullable();
            $table->decimal('regular_price', 10, 2);
            $table->decimal('selling_price', 10, 2);
            $table->decimal('discount_price', 10, 2)->nullable();
            $table->string('material')->nullable();
            $table->json('features')->nullable();
            $table->enum('availability', ['in_stock', 'out_of_stock', 'pre_order'])->default('in_stock');
            $table->string('product_url')->nullable();
            $table->decimal('delivery_charge_inside_dhaka', 8, 2)->default(70.00);
            $table->decimal('delivery_charge_outside_dhaka', 8, 2)->default(130.00);
            $table->string('estimated_delivery_time')->default('2-4 business days');
            $table->text('return_policy')->nullable();
            $table->text('exchange_policy')->nullable();
            $table->json('faqs')->nullable();
            $table->text('internal_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->string('size', 50)->nullable();
            $table->string('color', 50)->nullable();
            $table->string('sku')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->integer('stock')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['product_id', 'size', 'color']);
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->text('image_url');
            $table->boolean('is_primary')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('account_product_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_account_id')->constrained('social_accounts')->onDelete('cascade');
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['social_account_id', 'product_id']);
        });

        Schema::create('social_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_account_id')->constrained('social_accounts')->onDelete('cascade');
            $table->string('platform_post_id')->index();
            $table->text('message')->nullable();
            $table->text('media_url')->nullable();
            $table->text('permalink')->nullable();
            $table->boolean('is_auto_reply_enabled')->default(true);
            $table->string('reply_tone', 50)->default('friendly');
            $table->string('ai_model', 50)->nullable();
            $table->boolean('manual_approval_required')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['social_account_id', 'platform_post_id']);
        });

        Schema::create('post_product_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->onDelete('cascade');
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['social_post_id', 'product_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('post_product_mappings');
        Schema::dropIfExists('social_posts');
        Schema::dropIfExists('account_product_mappings');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_categories');
    }
};

