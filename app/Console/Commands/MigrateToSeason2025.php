<?php

namespace App\Console\Commands;

use App\Models\Season;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateToSeason2025 extends Command
{
    protected $signature = 'season:migrate-2025-26
                            {--force : 確認なしで実行する}';

    protected $description = '既存の全ユーザーを「2025-26」シーズンとして登録します';

    public function handle(): int
    {
        $seasonName = '2025-26';

        $unassigned = User::whereNull('season_id')->count();
        $this->info("シーズン未割当のユーザー数: {$unassigned} 人");

        if ($unassigned === 0) {
            $this->info('移行対象のユーザーがいません。処理をスキップします。');
            return self::SUCCESS;
        }

        if (! $this->option('force')) {
            if (! $this->confirm("これらのユーザーをシーズン「{$seasonName}」として登録しますか？")) {
                $this->info('キャンセルしました。');
                return self::SUCCESS;
            }
        }

        DB::transaction(function () use ($seasonName) {
            // 既存の同名シーズンがあれば使う、なければ作成
            $season = Season::firstOrCreate(
                ['name' => $seasonName],
                ['is_active' => false, 'note' => '移行データ（2025-26シーズン）'],
            );

            $this->info("シーズン「{$seasonName}」(ID: {$season->id}) を使用します。");

            // 他のアクティブシーズンを非アクティブに
            Season::where('is_active', true)
                ->where('id', '!=', $season->id)
                ->update(['is_active' => false]);

            // このシーズンをアクティブに
            $season->update(['is_active' => true]);

            // season_id が NULL のユーザーを全員このシーズンに割り当て
            $count = User::whereNull('season_id')->update(['season_id' => $season->id]);

            $this->info("✓ {$count} 人のユーザーをシーズン「{$seasonName}」に移行しました。");
        });

        $this->info('データ移行が完了しました。');
        return self::SUCCESS;
    }
}
