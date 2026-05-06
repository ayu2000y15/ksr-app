<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Season;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SeasonController extends Controller
{
    /**
     * シーズン一覧ページ
     */
    public function index()
    {
        $this->authorizeAdmin();

        $seasons = Season::withCount('users')
            ->orderByDesc('created_at')
            ->get();

        $activeSeason = Season::where('is_active', true)->first();

        return Inertia::render('admin/seasons', [
            'seasons' => $seasons,
            'activeSeason' => $activeSeason,
        ]);
    }

    /**
     * 新しいシーズンを作成
     */
    public function store(Request $request)
    {
        $this->authorizeAdmin();

        $request->validate([
            'name' => 'required|string|max:100|unique:seasons,name',
            'note' => 'nullable|string|max:500',
        ], [
            'name.required' => 'シーズン名は必須です。',
            'name.unique' => '同じシーズン名が既に存在します。',
            'name.max' => 'シーズン名は100文字以内で入力してください。',
        ]);

        DB::transaction(function () use ($request) {
            // 既存のアクティブシーズンを非アクティブにする
            Season::where('is_active', true)->update(['is_active' => false]);

            // 新しいシーズンを作成
            Season::create([
                'name' => $request->name,
                'is_active' => true,
                'note' => $request->note,
            ]);
        });

        return redirect()->route('admin.seasons.index')
            ->with('success', "シーズン「{$request->name}」を作成しました。");
    }

    /**
     * シーズンを終了する（全データを読み取り専用に）
     */
    public function end(Request $request, Season $season)
    {
        $this->authorizeAdmin();

        if (! $season->is_active) {
            return back()->with('error', 'このシーズンは既に終了しています。');
        }

        $season->update([
            'is_active' => false,
            'ended_at' => now(),
        ]);

        return redirect()->route('admin.seasons.index')
            ->with('success', "シーズン「{$season->name}」を終了しました。新しいシーズンを作成してください。");
    }

    /**
     * シーズンを再アクティブ化（管理者操作）
     */
    public function activate(Request $request, Season $season)
    {
        $this->authorizeAdmin();

        if ($season->ended_at !== null) {
            return back()->with('error', '終了済みのシーズンは再アクティブ化できません。');
        }

        DB::transaction(function () use ($season) {
            Season::where('is_active', true)->update(['is_active' => false]);
            $season->update(['is_active' => true]);
        });

        return redirect()->route('admin.seasons.index')
            ->with('success', "シーズン「{$season->name}」をアクティブにしました。");
    }

    private function authorizeAdmin(): void
    {
        $user = Auth::user();
        if (! $user->hasRole('システム管理者')) {
            abort(403, 'この操作はシステム管理者のみ実行できます。');
        }
    }
}
