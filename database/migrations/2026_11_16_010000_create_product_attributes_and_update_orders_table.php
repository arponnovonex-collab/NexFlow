<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create product_attributes table
        if (! Schema::hasTable('product_attributes')) {
            Schema::create('product_attributes', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('type')->default('button'); // button, select, color
                $table->boolean('is_required')->default(false);
                $table->integer('sort_order')->default(0);
                $table->timestamps();
            });
        }

        // 2. Create product_attribute_values table
        if (! Schema::hasTable('product_attribute_values')) {
            Schema::create('product_attribute_values', function (Blueprint $table) {
                $table->id();
                $table->foreignId('attribute_id')->constrained('product_attributes')->onDelete('cascade');
                $table->string('name');
                $table->string('value')->nullable(); // e.g. #FF0000 for color, or label
                $table->integer('sort_order')->default(0);
                $table->timestamps();

                $table->index(['attribute_id', 'sort_order']);
            });
        }

        // 3. Update orders table with customer_email, size, color, order_attributes
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'customer_email')) {
                $table->string('customer_email')->nullable()->after('customer_phone');
            }
            if (! Schema::hasColumn('orders', 'size')) {
                $table->string('size', 50)->nullable()->after('variant_id');
            }
            if (! Schema::hasColumn('orders', 'color')) {
                $table->string('color', 50)->nullable()->after('size');
            }
            if (! Schema::hasColumn('orders', 'order_attributes')) {
                $table->json('order_attributes')->nullable()->after('color');
            }
        });

        // 4. Update products table with wc_product_id and attributes json
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'wc_product_id')) {
                $table->unsignedBigInteger('wc_product_id')->nullable()->unique()->after('id');
            }
            if (! Schema::hasColumn('products', 'attributes')) {
                $table->json('attributes')->nullable()->after('material');
            }
        });

        // 5. Seed default standard attributes (Size & Color) if none exist
        try {
            $now = now();
            if (DB::table('product_attributes')->count() === 0) {
                // Size attribute
                $sizeId = DB::table('product_attributes')->insertGetId([
                    'name' => 'Size',
                    'slug' => 'size',
                    'type' => 'button',
                    'is_required' => false,
                    'sort_order' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $defaultSizes = ['S', 'M', 'L', 'XL', 'XXL'];
                foreach ($defaultSizes as $idx => $s) {
                    DB::table('product_attribute_values')->insert([
                        'attribute_id' => $sizeId,
                        'name' => $s,
                        'value' => $s,
                        'sort_order' => $idx + 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                // Color attribute
                $colorId = DB::table('product_attributes')->insertGetId([
                    'name' => 'Color',
                    'slug' => 'color',
                    'type' => 'color',
                    'is_required' => false,
                    'sort_order' => 2,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $defaultColors = [
                    ['name' => 'Black', 'value' => '#000000'],
                    ['name' => 'White', 'value' => '#FFFFFF'],
                    ['name' => 'Red', 'value' => '#EF4444'],
                    ['name' => 'Blue', 'value' => '#3B82F6'],
                    ['name' => 'Navy', 'value' => '#1E3A8A'],
                    ['name' => 'Olive', 'value' => '#65A30D'],
                    ['name' => 'Maroon', 'value' => '#831843'],
                ];
                foreach ($defaultColors as $idx => $c) {
                    DB::table('product_attribute_values')->insert([
                        'attribute_id' => $colorId,
                        'name' => $c['name'],
                        'value' => $c['value'],
                        'sort_order' => $idx + 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            // Ignore seeding error if tables were already partially populated
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_attribute_values');
        Schema::dropIfExists('product_attributes');

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'customer_email')) {
                $table->dropColumn('customer_email');
            }
            if (Schema::hasColumn('orders', 'size')) {
                $table->dropColumn('size');
            }
            if (Schema::hasColumn('orders', 'color')) {
                $table->dropColumn('color');
            }
            if (Schema::hasColumn('orders', 'order_attributes')) {
                $table->dropColumn('order_attributes');
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'wc_product_id')) {
                $table->dropColumn('wc_product_id');
            }
            if (Schema::hasColumn('products', 'attributes')) {
                $table->dropColumn('attributes');
            }
        });
    }
};
