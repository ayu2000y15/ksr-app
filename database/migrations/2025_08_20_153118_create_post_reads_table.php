<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_reads', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('post_id')->comment('投稿ID')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->comment('既読ユーザーID')->constrained()->onDelete('cascade');
            $table->timestamp('read_at')->comment('既読日時');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_reads');
    }
};
