<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_items', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('post_id')->comment('投稿ID')->constrained()->onDelete('cascade');
            $table->integer('order')->comment('順序');
            $table->text('content')->nullable()->comment('テキスト内容');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_items');
    }
};
