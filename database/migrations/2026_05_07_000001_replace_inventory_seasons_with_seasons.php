<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. inventory_seasons の既存データを seasons テーブルへ統合
        //    既に name が一致するレコードがある場合はスキップ
        $inventorySeasons = DB::table('inventory_seasons')->get();
        foreach ($inventorySeasons as $is) {
            $exists = DB::table('seasons')->where('name', $is->name)->exists();
            if (!$exists) {
                DB::table('seasons')->insert([
                    'name'       => $is->name,
                    'is_active'  => false,
                    'ended_at'   => null,
                    'note'       => $is->note,
                    'created_at' => $is->created_at,
                    'updated_at' => $is->updated_at,
                ]);
            }
        }

        // 2. inventory_stock.season_id の FK を inventory_seasons → seasons に張り替える
        //    まずデータを移行（name を使って inventory_seasons.id → seasons.id に変換）
        Schema::table('inventory_stock', function (Blueprint $table) {
            $table->dropForeign(['season_id']);
        });

        // season_id 値を変換: inventory_seasons.id 経由で名前を特定し seasons.id に差し替え
        $inventorySeasonsMap = DB::table('inventory_seasons')->get()->keyBy('id');
        $seasonsMap = DB::table('seasons')->get()->keyBy('name');

        $stocks = DB::table('inventory_stock')->whereNotNull('season_id')->get();
        foreach ($stocks as $stock) {
            $oldSeason = $inventorySeasonsMap->get($stock->season_id);
            if ($oldSeason) {
                $newSeason = $seasonsMap->get($oldSeason->name);
                if ($newSeason) {
                    DB::table('inventory_stock')
                        ->where('id', $stock->id)
                        ->update(['season_id' => $newSeason->id]);
                } else {
                    DB::table('inventory_stock')
                        ->where('id', $stock->id)
                        ->update(['season_id' => null]);
                }
            }
        }

        // 新しい FK 制約を seasons テーブルに追加
        Schema::table('inventory_stock', function (Blueprint $table) {
            $table->foreign('season_id')
                ->references('id')
                ->on('seasons')
                ->nullOnDelete();
        });

        // 3. damaged_inventories に season_id を追加
        Schema::table('damaged_inventories', function (Blueprint $table) {
            $table->foreignId('season_id')
                ->nullable()
                ->after('id')
                ->constrained('seasons')
                ->nullOnDelete()
                ->comment('シーズンID');
        });

        // 4. properties に season_id を追加
        Schema::table('properties', function (Blueprint $table) {
            $table->foreignId('season_id')
                ->nullable()
                ->after('id')
                ->constrained('seasons')
                ->nullOnDelete()
                ->comment('シーズンID');
        });

        // 5. inventory_seasons テーブルを削除
        Schema::dropIfExists('inventory_seasons');
    }

    public function down(): void
    {
        // inventory_seasons テーブルを再作成
        Schema::create('inventory_seasons', function (Blueprint $table) {
            $table->id();
            $table->string('name', 20)->unique();
            $table->boolean('is_active')->default(false);
            $table->string('note', 255)->nullable();
            $table->timestamps();
        });

        // properties の season_id を削除
        Schema::table('properties', function (Blueprint $table) {
            $table->dropForeign(['season_id']);
            $table->dropColumn('season_id');
        });

        // damaged_inventories の season_id を削除
        Schema::table('damaged_inventories', function (Blueprint $table) {
            $table->dropForeign(['season_id']);
            $table->dropColumn('season_id');
        });

        // inventory_stock の FK を inventory_seasons に戻す
        Schema::table('inventory_stock', function (Blueprint $table) {
            $table->dropForeign(['season_id']);
            $table->foreign('season_id')
                ->references('id')
                ->on('inventory_seasons')
                ->nullOnDelete();
        });
    }
};
