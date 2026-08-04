<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SeasonNoSeeder extends Seeder
{
    public function run(): void
    {
        // season_no が未設定のユーザーを season_id ごとに position → id 順で採番する
        // 既に season_no 設定済みのユーザーはスキップ

        $groups = DB::table('users')
            ->whereNull('season_no')
            ->orderBy('season_id')
            ->orderBy('position')
            ->orderBy('id')
            ->get(['id', 'season_id']);

        // season_id ごとに既存の最大値からカウンターを初期化
        $counters = DB::table('users')
            ->whereNotNull('season_no')
            ->selectRaw('season_id, MAX(season_no) as max_no')
            ->groupBy('season_id')
            ->pluck('max_no', 'season_id')
            ->toArray();

        foreach ($groups as $user) {
            $key = $user->season_id ?? 'null';
            $counters[$key] = ($counters[$key] ?? 0) + 1;

            DB::table('users')
                ->where('id', $user->id)
                ->update(['season_no' => $counters[$key]]);
        }

        $this->command->info("season_no を {$groups->count()} 人に採番しました。");
    }
}
