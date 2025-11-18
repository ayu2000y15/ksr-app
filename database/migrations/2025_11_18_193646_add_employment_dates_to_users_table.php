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
        Schema::table('users', function (Blueprint $table) {
            // 勤務開始日と勤務終了日を追加
            $table->date('employment_start_date')->nullable()->comment('勤務開始日');
            $table->date('employment_end_date')->nullable()->comment('勤務終了日');

            // 勤務期間カラムを削除
            $table->dropColumn('employment_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // 勤務開始日と勤務終了日を削除
            $table->dropColumn(['employment_start_date', 'employment_end_date']);

            // 勤務期間カラムを復元
            $table->string('employment_period')->nullable()->comment('勤務期間');
        });
    }
};
