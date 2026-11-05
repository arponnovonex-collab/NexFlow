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
        if (! Schema::hasTable('media_folders')) {
            Schema::create('media_folders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('name');
                $table->string('slug')->index();
                $table->string('color', 30)->default('#6366f1');
                $table->text('description')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable()->index();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('media_files') && ! Schema::hasColumn('media_files', 'folder_id')) {
            Schema::table('media_files', function (Blueprint $table) {
                $table->unsignedBigInteger('folder_id')->nullable()->after('user_id')->index();
                $table->foreign('folder_id')->references('id')->on('media_folders')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('media_files') && Schema::hasColumn('media_files', 'folder_id')) {
            Schema::table('media_files', function (Blueprint $table) {
                $table->dropForeign(['folder_id']);
                $table->dropColumn('folder_id');
            });
        }

        Schema::dropIfExists('media_folders');
    }
};
