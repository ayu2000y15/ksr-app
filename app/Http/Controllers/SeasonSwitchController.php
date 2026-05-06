<?php

namespace App\Http\Controllers;

use App\Models\Season;
use App\Models\User;
use Illuminate\Http\Request;

class SeasonSwitchController extends Controller
{
    /**
     * セッションの閲覧シーズンを切り替える
     */
    public function store(Request $request)
    {
        $request->validate(['season_id' => 'required|integer|exists:seasons,id']);

        $user = $request->user();
        $isSuperAdmin = $user->roles()->where('name', 'システム管理者')->exists();

        if (! $isSuperAdmin) {
            // 同じメールアドレスがそのシーズンに存在するかチェック
            $allowed = User::where('email', $user->email)
                ->where('season_id', $request->season_id)
                ->exists();

            if (! $allowed) {
                abort(403, 'このシーズンへのアクセス権限がありません。');
            }
        }

        session(['viewing_season_id' => (int) $request->season_id]);

        return back();
    }
}
