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
        Schema::create('courier_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('steadfast');
            $table->text('api_key')->nullable();
            $table->text('secret_key')->nullable();
            $table->boolean('is_enabled')->default(false);
            $table->string('contact_name')->default('Auliro');
            $table->string('contact_phone')->default('01333-447475');
            $table->string('delivery_type')->default('home');
            $table->decimal('last_balance', 10, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('courier_name')->nullable()->after('notes');
            $table->string('consignment_id')->nullable()->after('courier_name');
            $table->string('tracking_code')->nullable()->after('consignment_id');
            $table->string('courier_status')->nullable()->after('tracking_code');
            $table->timestamp('courier_sent_at')->nullable()->after('courier_status');
            $table->json('courier_response')->nullable()->after('courier_sent_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'courier_name',
                'consignment_id',
                'tracking_code',
                'courier_status',
                'courier_sent_at',
                'courier_response',
            ]);
        });

        Schema::dropIfExists('courier_settings');
    }
};
