<?php

namespace App\Console\Commands;

use App\Models\Season;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateAllDataToSeason extends Command
{
    protected $signature = 'season:migrate-all
                            {season_name : 移行先シーズン名（例: 2025-26）}
                            {--force : 確認なしで実行する}';

    protected $description = '在庫・破損在庫・物件・ユーザーの全データを指定シーズンに移行し、そのシーズンをアクティブにします';

    public function handle(): int
    {
        $seasonName = $this->argument('season_name');

        if (!preg_match('/^\d{4}-\d{2}$/', $seasonName)) {
            $this->error("シーズン名の形式が正しくありません。YYYY-YY 形式で指定してください（例: 2025-26）");
            return self::FAILURE;
        }

        // 現在の状況を表示
        $this->info("=== 移行先シーズン: {$seasonName} ===");
        $this->newLine();

        $userCount   = DB::table('users')->whereNull('season_id')->count();
        $stockCount  = DB::table('inventory_stock')->where(function ($q) use ($seasonName) {
            // 移行先以外のシーズンまたはNULLのレコードを対象
            $target = DB::table('seasons')->where('name', $seasonName)->value('id');
            if ($target) {
                $q->whereNull('season_id')->orWhere('season_id', '!=', $target);
            } else {
                $q->whereNull('season_id');
            }
        })->count();
        $damagedCount = DB::table('damaged_inventories')->whereNull('season_id')->count();
        $propCount    = DB::table('properties')->whereNull('season_id')->count();

        $this->table(['対象データ', '件数'], [
            ['シーズン未割当ユーザー', $userCount],
            ['シーズン未割当在庫',     $stockCount],
            ['シーズン未割当破損在庫', $damagedCount],
            ['シーズン未割当物件',     $propCount],
        ]);

        $this->newLine();

        if (!$this->option('force')) {
            if (!$this->confirm("上記のデータをシーズン「{$seasonName}」に移行し、アクティブシーズンに設定しますか？")) {
                $this->info('キャンセルしました。');
                return self::SUCCESS;
            }
        }

        DB::transaction(function () use ($seasonName) {
            // 移行先シーズンを取得または作成
            $season = Season::firstOrCreate(
                ['name' => $seasonName],
                ['is_active' => false, 'note' => "移行データ（{$seasonName}シーズン）"],
            );

            $this->info("シーズン「{$seasonName}」(ID: {$season->id}) を使用します。");

            // 他のシーズンをすべて非アクティブに
            Season::where('id', '!=', $season->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            // 移行先シーズンをアクティブに
            $season->update(['is_active' => true, 'ended_at' => null]);

            // ユーザー: season_id が NULL のものを移行
            $uCount = DB::table('users')
                ->whereNull('season_id')
                ->update(['season_id' => $season->id]);
            $this->info("✓ ユーザー: {$uCount} 件を移行しました。");

            // 在庫: season_id が NULL のものを移行（他シーズンのものはそのまま）
            $sCount = DB::table('inventory_stock')
                ->whereNull('season_id')
                ->update(['season_id' => $season->id]);
            $this->info("✓ 在庫: {$sCount} 件を移行しました（NULLのもの）。");

            // 在庫: 他シーズンに割り当て済みのものも移行対象かを確認
            $otherSeasonStocks = DB::table('inventory_stock')
                ->where('season_id', '!=', $season->id)
                ->count();
            if ($otherSeasonStocks > 0) {
                $this->warn("  ※ 他シーズンに割り当て済みの在庫が {$otherSeasonStocks} 件あります（移行しませんでした）。");
            }

            // 破損在庫: season_id が NULL のものを移行
            $dCount = DB::table('damaged_inventories')
                ->whereNull('season_id')
                ->update(['season_id' => $season->id]);
            $this->info("✓ 破損在庫: {$dCount} 件を移行しました。");

            // 物件: season_id が NULL のものを移行
            $pCount = DB::table('properties')
                ->whereNull('season_id')
                ->update(['season_id' => $season->id]);
            $this->info("✓ 物件: {$pCount} 件を移行しました。");
        });

        $this->newLine();
        $this->info("=== データ移行が完了しました ===");
        $this->info("アクティブシーズン: {$seasonName}");

        return self::SUCCESS;
    }
}
