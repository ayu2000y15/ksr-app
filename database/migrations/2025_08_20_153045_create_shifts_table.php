<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->comment('ユーザーID')->constrained()->onDelete('cascade');
            $table->date('date')->comment('勤務日');
            $table->dateTime('start_time')->comment('開始日時');
            $table->dateTime('end_time')->comment('終了日時');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};
