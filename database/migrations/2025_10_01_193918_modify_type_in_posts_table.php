<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // typeカラムの定義を更新し、'poll'を追加する
            $table->enum('type', ['board', 'manual', 'poll'])->default('board')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // 元に戻す処理（'poll'を削除する）
            $table->enum('type', ['board', 'manual'])->default('board')->change();
        });
    }
};
