<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('breaks', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('shift_id')->comment('シフトID')->constrained()->onDelete('cascade');
            $table->enum('type', ['scheduled', 'actual'])->comment('種別 (予定/実績)');
            $table->dateTime('start_time')->comment('予定開始日時');
            $table->dateTime('end_time')->comment('予定終了日時');
            $table->dateTime('actual_start_time')->nullable()->comment('実績開始日時');
            $table->dateTime('actual_end_time')->nullable()->comment('実績終了日時');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('breaks');
    }
};
