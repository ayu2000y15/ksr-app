<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedbacks', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->nullable()->comment('ユーザーID')->constrained()->onDelete('set null');
            $table->string('title')->comment('タイトル');
            $table->string('category')->comment('カテゴリ');
            $table->string('priority')->comment('優先度');
            $table->text('body')->comment('内容');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedbacks');
    }
};
