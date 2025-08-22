<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // このマイグレーションは既に実行済みです
        // Spatieのpermissionテーブルは保持します
        // 何も実行しません
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // このマイグレーションはダウンロールしない（元のテーブル構造は復元しない）
    }
};
