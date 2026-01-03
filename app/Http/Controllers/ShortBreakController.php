<?php

namespace App\Http\Controllers;

use App\Models\ShortBreak;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class ShortBreakController extends Controller
{
    /**
     * 10分休憩を記録する
     */
    public function store(Request $request)
    {
        // 権限チェック: shift.daily.manage権限が必要
        if (!Auth::user()->hasRole('システム管理者') && !Auth::user()->hasPermissionTo('shift.daily.manage')) {
            abort(403, '10分休憩を記録する権限がありません。');
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        $now = Carbon::now();
        $startTime = $now->format('H:i:s');

        $shortBreak = ShortBreak::updateOrCreate(
            [
                'user_id' => $validated['user_id'],
                'date' => $validated['date'],
            ],
            [
                'start_time' => $startTime,
            ]
        );

        return response()->json([
            'message' => '10分休憩を記録しました',
            'short_break' => $shortBreak,
        ]);
    }

    /**
     * 10分休憩を削除する
     */
    public function destroy(Request $request)
    {
        // 権限チェック: shift.daily.manage権限が必要
        if (!Auth::user()->hasRole('システム管理者') && !Auth::user()->hasPermissionTo('shift.daily.manage')) {
            abort(403, '10分休憩を削除する権限がありません。');
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        ShortBreak::where('user_id', $validated['user_id'])
            ->where('date', $validated['date'])
            ->delete();

        return response()->json([
            'message' => '10分休憩を削除しました',
        ]);
    }
}
