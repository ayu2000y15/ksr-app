<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_seasons', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique()->comment('シーズン名 (例: 2024-25)');
            $table->boolean('is_active')->default(false)->comment('現在のアクティブシーズン');
            $table->text('note')->nullable()->comment('メモ');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_seasons');
    }
};
