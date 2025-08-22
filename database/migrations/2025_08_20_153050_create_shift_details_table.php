<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_details', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->comment('ユーザーID')->constrained()->onDelete('cascade');
            $table->date('date')->comment('勤務日');
            $table->enum('type', ['work', 'break'])->comment('種別 (勤務/休憩)');
            $table->dateTime('start_time')->nullable()->comment('開始日時');
            $table->dateTime('end_time')->nullable()->comment('終了日時');
            $table->enum('status', ['scheduled', 'actual', 'absent'])->default('scheduled')->comment('状態 (予定/実績/欠席)');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_details');
    }
};
