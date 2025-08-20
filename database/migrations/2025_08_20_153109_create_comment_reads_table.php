<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comment_reads', function (Blueprint $table) {
            $table->foreignId('comment_id')->comment('コメントID')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->comment('既読ユーザーID')->constrained()->onDelete('cascade');
            $table->timestamp('read_at')->comment('既読日時');
            $table->primary(['comment_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_reads');
    }
};
