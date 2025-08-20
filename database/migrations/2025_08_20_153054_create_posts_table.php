<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->comment('投稿ユーザーID')->constrained()->onDelete('cascade');
            $table->enum('type', ['board', 'manual'])->comment('種別 (掲示板/マニュアル)');
            $table->string('title')->comment('タイトル');
            $table->text('body')->comment('本文');
            $table->boolean('is_public')->default(true)->comment('全体公開フラグ');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
