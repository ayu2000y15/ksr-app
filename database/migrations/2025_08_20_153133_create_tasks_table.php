<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->comment('作成ユーザーID')->constrained()->onDelete('cascade');
            $table->string('title')->comment('タイトル');
            $table->text('description')->nullable()->comment('内容');
            $table->dateTime('start_at')->comment('開始日時');
            $table->dateTime('end_at')->nullable()->comment('終了日時');
            $table->boolean('is_public')->default(false)->comment('公開フラグ');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
