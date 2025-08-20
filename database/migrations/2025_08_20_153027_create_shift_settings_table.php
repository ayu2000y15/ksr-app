<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_settings', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->integer('apply_deadline_days')->default(14)->comment('申請期限日数');
            $table->time('default_schedule_view_start_time')->nullable()->comment('タイムスケジュール表示開始時間');
            $table->time('default_schedule_view_end_time')->nullable()->comment('タイムスケジュール表示終了時間');
            $table->integer('schedule_interval_minutes')->default(30)->comment('タイムスケジュール表示間隔(分)');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_settings');
    }
};
