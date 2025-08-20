<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_reports', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->comment('ユーザーID')->constrained()->onDelete('cascade');
            $table->string('title')->comment('タイトル');
            $table->date('date')->comment('日付');
            $table->text('body')->comment('内容');
            $table->boolean('is_public')->default(false)->comment('公開フラグ');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_reports');
    }
};
