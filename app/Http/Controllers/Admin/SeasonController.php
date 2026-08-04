<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Season;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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

    /**
     * 指定シーズンのユーザー一覧を返す（再利用候補選択用）
     */
    public function users(Season $season)
    {
        $this->authorizeAdmin();

        $activeSeason = Season::where('is_active', true)->first();
        $existingEmails = $activeSeason
            ? User::where('season_id', $activeSeason->id)->pluck('email')->toArray()
            : [];

        $users = User::where('season_id', $season->id)
            ->with('roles')
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->map(fn($u) => [
                'id'               => $u->id,
                'name'             => $u->name,
                'furigana'         => $u->furigana,
                'email'            => $u->email,
                'position'         => $u->position,
                'gender'           => $u->gender,
                'roles'            => $u->roles->pluck('name'),
                'already_imported' => in_array($u->email, $existingEmails),
            ]);

        return response()->json($users);
    }

    /**
     * 選択したユーザーをアクティブシーズンへコピー（アカウント再利用）
     */
    public function importUsers(Request $request, Season $season)
    {
        $this->authorizeAdmin();

        $request->validate([
            'user_ids'   => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        $activeSeason = Season::where('is_active', true)->first();
        if (! $activeSeason) {
            return back()->with('error', 'アクティブなシーズンがありません。先に新しいシーズンを作成してください。');
        }
        if ($activeSeason->id === $season->id) {
            return back()->with('error', '同じシーズンへのインポートはできません。');
        }

        $sourceUsers = User::whereIn('id', $request->user_ids)
            ->where('season_id', $season->id)
            ->with('roles')
            ->get();

        $imported = 0;
        $skipped  = 0;

        DB::transaction(function () use ($sourceUsers, $activeSeason, &$imported, &$skipped) {
            foreach ($sourceUsers as $source) {
                $exists = User::where('season_id', $activeSeason->id)
                    ->where('email', $source->email)
                    ->exists();
                if ($exists) {
                    $skipped++;
                    continue;
                }

                $temporaryPassword = Str::random(10);

                $newUser = User::create([
                    'season_id'                 => $activeSeason->id,
                    'season_no'                 => User::where('season_id', $activeSeason->id)->max('season_no') + 1,
                    'name'                      => $source->name,
                    'furigana'                  => $source->furigana,
                    'email'                     => $source->email,
                    'password'                  => Hash::make($temporaryPassword),
                    'temporary_password'        => $temporaryPassword,
                    'phone_number'              => $source->phone_number,
                    'line_name'                 => $source->line_name,
                    'position'                  => $source->position,
                    'gender'                    => $source->gender,
                    'has_car'                   => $source->has_car,
                    'status'                    => 'active',
                    'memo'                      => $source->memo,
                    'must_change_password'      => true,
                    'employment_condition'      => $source->employment_condition,
                    'commute_method'            => $source->commute_method,
                    'default_start_time'        => $source->default_start_time,
                    'default_end_time'          => $source->default_end_time,
                    'preferred_week_days'       => $source->preferred_week_days,
                    'preferred_week_days_count' => $source->preferred_week_days_count,
                ]);

                $roleNames = $source->roles->pluck('name')->toArray();
                if (! empty($roleNames)) {
                    $newUser->assignRole($roleNames);
                }

                $imported++;
            }
        });

        $message = "{$imported}人のユーザーをインポートしました。";
        if ($skipped > 0) {
            $message .= "（{$skipped}人は既に登録済みのためスキップ）";
        }

        return redirect()->route('admin.seasons.index')->with('success', $message);
    }

    private function authorizeAdmin(): void
    {
        $user = Auth::user();
        if (! $user->hasRole('システム管理者')) {
            abort(403, 'この操作はシステム管理者のみ実行できます。');
        }
    }
}
