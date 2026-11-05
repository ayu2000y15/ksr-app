<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 各種申請ページの注意書き（HTML）を各種設定「その他」ページから編集できるようにするためのカラム追加。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shift_settings', function (Blueprint $table) {
            $table->text('shift_applications_notice')->nullable()->comment('各種申請ページの注意書き(HTML)');
        });
    }

    public function down(): void
    {
        Schema::table('shift_settings', function (Blueprint $table) {
            $table->dropColumn('shift_applications_notice');
        });
    }
};
