<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // 既存の email unique インデックスを削除
            $table->dropUnique(['email']);
            // season_id を追加（nullable: 既存ユーザーはシーズン未割当）
            $table->foreignId('season_id')->nullable()->after('id')->constrained('seasons')->nullOnDelete();
            // シーズン内でメールアドレスをユニークにする複合インデックス
            // （season_id が NULL の場合は別途チェック）
            $table->unique(['email', 'season_id']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email', 'season_id']);
            $table->dropForeign(['season_id']);
            $table->dropColumn('season_id');
            $table->unique('email');
        });
    }
};
