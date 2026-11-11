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
        if (Schema::hasTable('saved_messages') && ! Schema::hasColumn('saved_messages', 'image_url')) {
            Schema::table('saved_messages', function (Blueprint $table) {
                $table->string('image_url', 500)->nullable()->after('content');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('saved_messages') && Schema::hasColumn('saved_messages', 'image_url')) {
            Schema::table('saved_messages', function (Blueprint $table) {
                $table->dropColumn('image_url');
            });
        }
    }
};
