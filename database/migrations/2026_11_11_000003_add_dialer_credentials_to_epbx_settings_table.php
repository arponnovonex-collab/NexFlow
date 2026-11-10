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
        Schema::table('epbx_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('epbx_settings', 'extension_password')) {
                $table->string('extension_password', 255)->nullable()->after('default_extension');
            }
            if (! Schema::hasColumn('epbx_settings', 'sip_server')) {
                $table->string('sip_server', 100)->nullable()->default('103.15.140.151')->after('extension_password');
            }
            if (! Schema::hasColumn('epbx_settings', 'sip_port')) {
                $table->string('sip_port', 10)->nullable()->default('5060')->after('sip_server');
            }
            if (! Schema::hasColumn('epbx_settings', 'web_dialer_url')) {
                $table->string('web_dialer_url', 255)->nullable()->default('https://auliro010.epbx.bd/dialer')->after('sip_port');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('epbx_settings', function (Blueprint $table) {
            if (Schema::hasColumn('epbx_settings', 'extension_password')) {
                $table->dropColumn('extension_password');
            }
            if (Schema::hasColumn('epbx_settings', 'sip_server')) {
                $table->dropColumn('sip_server');
            }
            if (Schema::hasColumn('epbx_settings', 'sip_port')) {
                $table->dropColumn('sip_port');
            }
            if (Schema::hasColumn('epbx_settings', 'web_dialer_url')) {
                $table->dropColumn('web_dialer_url');
            }
        });
    }
};

