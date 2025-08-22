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
        // 外部キー制約を無効化
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        // 既存の自作テーブルが存在する場合は削除（順序に注意）
        if (Schema::hasTable('permission_role')) {
            Schema::dropIfExists('permission_role');
        }
        
        if (Schema::hasTable('role_user')) {
            Schema::dropIfExists('role_user');
        }
        
        if (Schema::hasTable('permissions')) {
            Schema::dropIfExists('permissions');
        }
        
        if (Schema::hasTable('roles')) {
            Schema::dropIfExists('roles');
        }

        // 外部キー制約を再度有効化
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // Spatieのキャッシュをクリア
        try {
            app('cache')
                ->store(config('permission.cache.store') != 'default' ? config('permission.cache.store') : null)
                ->forget(config('permission.cache.key'));
        } catch (\Exception $e) {
            // キャッシュのクリアに失敗しても継続
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // このマイグレーションはダウンロールしない（元のテーブル構造は復元しない）
    }
};
