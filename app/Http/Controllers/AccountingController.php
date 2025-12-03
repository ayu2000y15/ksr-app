<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\Shift;
use App\Models\ShiftDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AccountingController extends Controller
{
    /**
     * 経理向けカレンダー画面
     */
    public function index(Request $request)
    {
        // accounting.view 権限チェック
        $this->authorize('accounting.view');

        // 表示する月を決定（?month=YYYY-MM-DD がなければ当月）
        $month = $request->get('month') ? Carbon::parse($request->get('month')) : Carbon::now();

        // 月の開始・終了
        $start = $month->copy()->startOfMonth();
        $end = $month->copy()->endOfMonth();

        // 祝日を取得
        $holidays = Holiday::whereBetween('date', [$start, $end])
            ->get(['date', 'name'])
            ->map(function ($h) {
                return [
                    'date' => Carbon::parse($h->date)->toDateString(),
                    'name' => $h->name ?? '',
                ];
            })->toArray();

        // 各日付の出勤人数を集計（type=work のシフト詳細が存在する日）
        $shiftDetails = ShiftDetail::whereBetween('date', [$start, $end])
            ->where('type', 'work')
            ->with('user')
            ->get();

        $dailySummary = [];
        foreach ($shiftDetails as $detail) {
            $date = Carbon::parse($detail->date)->toDateString();
            if (!isset($dailySummary[$date])) {
                $dailySummary[$date] = ['count' => 0, 'users' => []];
            }
            // ユーザーごとに1回だけカウント
            $userName = $detail->user ? $detail->user->name : '';
            if ($userName && !in_array($userName, $dailySummary[$date]['users'])) {
                $dailySummary[$date]['count']++;
                $dailySummary[$date]['users'][] = $userName;
            }
        }

        return Inertia::render('accounting/index', [
            'month' => $month->toDateString(),
            'holidays' => $holidays,
            'dailySummary' => $dailySummary,
        ]);
    }

    /**
     * 指定日の詳細データ（各ユーザーの出勤・休憩時間）を返す
     */
    public function dailyDetail(Request $request)
    {
        // accounting.view 権限チェック
        $this->authorize('accounting.view');

        $date = $request->get('date'); // YYYY-MM-DD
        if (!$date) {
            return response()->json(['error' => 'date parameter required'], 400);
        }

        // 指定日のシフト詳細を取得（確定された実績のみ: status='actual'）
        $shiftDetails = ShiftDetail::where('date', $date)
            ->where('status', 'actual')
            ->with('user')
            ->orderBy('user_id')
            ->orderBy('start_time')
            ->get();

        // ユーザーごとにグループ化
        $grouped = $shiftDetails->groupBy('user_id');

        $result = [];
        foreach ($grouped as $userId => $details) {
            $user = $details->first()->user;
            if (!$user) {
                continue;
            }

            $workDetails = $details->where('type', 'work');
            $breakDetails = $details->where('type', 'break');

            // 出勤時間の集計（確定された実績のみ）
            $workMinutes = 0;
            $workPeriods = [];
            foreach ($workDetails as $detail) {
                if ($detail->start_time && $detail->end_time) {
                    $s = Carbon::parse($detail->start_time);
                    $e = Carbon::parse($detail->end_time);
                    $workMinutes += $s->diffInMinutes($e);
                    $workPeriods[] = [
                        'start' => $s->format('H:i'),
                        'end' => $e->format('H:i'),
                    ];
                }
            }

            // 休憩時間の集計（確定された実績のみ）
            $breakMinutes = 0;
            $breakPeriods = [];
            foreach ($breakDetails as $detail) {
                if ($detail->start_time && $detail->end_time) {
                    $s = Carbon::parse($detail->start_time);
                    $e = Carbon::parse($detail->end_time);
                    $breakMinutes += $s->diffInMinutes($e);
                    $breakPeriods[] = [
                        'start' => $s->format('H:i'),
                        'end' => $e->format('H:i'),
                    ];
                }
            }

            $result[] = [
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_position' => $user->position ?? $user->id,
                'work_minutes' => $workMinutes,
                'work_periods' => $workPeriods,
                'break_minutes' => $breakMinutes,
                'break_periods' => $breakPeriods,
            ];
        }

        // position 順にソート
        usort($result, function ($a, $b) {
            return $a['user_position'] <=> $b['user_position'];
        });

        return response()->json([
            'date' => $date,
            'shifts' => $result,
        ]);
    }
}
