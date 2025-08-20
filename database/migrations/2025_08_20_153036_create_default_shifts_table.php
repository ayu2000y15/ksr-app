<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('default_shifts', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('name')->comment('パターン名');
            $table->enum('type', ['weekday', 'holiday'])->comment('種別 (平日/休日)');
            $table->integer('day_of_week')->comment('曜日 (0:日曜 - 6:土曜)');
            $table->enum('shift_type', ['day', 'night'])->comment('勤務帯 (昼/夜)');
            $table->time('start_time')->comment('開始時間');
            $table->time('end_time')->comment('終了時間');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('default_shifts');
    }
};
