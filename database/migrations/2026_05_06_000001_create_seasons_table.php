<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seasons', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('シーズン名 (例: 2025-26シーズン)');
            $table->boolean('is_active')->default(false)->comment('現在アクティブなシーズン');
            $table->timestamp('ended_at')->nullable()->comment('シーズン終了日時');
            $table->text('note')->nullable()->comment('メモ');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seasons');
    }
};
