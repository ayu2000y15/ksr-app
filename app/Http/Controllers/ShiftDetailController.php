<?php

namespace App\Http\Controllers;

use App\Models\ShiftDetail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Shift;
use Illuminate\Support\Facades\Redirect;
use Carbon\Carbon;

class ShiftDetailController extends Controller
{
    public function store(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('create', ShiftDetail::class);
        }

        $messages = [
            'user_id.required' => 'ユーザーを選択してください。',
            'user_id.exists' => '選択されたユーザーは存在しません。',
            'date.required' => '日付は必須です。',
            'date.date' => '正しい日付を入力してください。',
            'start_time.required' => '開始日時は必須です。',
            'start_time.date_format' => '開始日時は Y-m-d H:i:s 形式で入力してください。',
            'end_time.required' => '終了日時は必須です。',
            'end_time.date_format' => '終了日時は Y-m-d H:i:s 形式で入力してください。',
            'end_time.after' => '終了日時は開始日時より後にしてください。',
        ];

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'start_time' => 'required|date_format:Y-m-d H:i:s',
            'end_time' => 'required|date_format:Y-m-d H:i:s|after:start_time',
            // allow 'outing' as a break-like type
            'type' => 'nullable|in:work,break,outing',
            'status' => 'nullable|in:scheduled,actual,absent',
        ], $messages);

        // If this is a break, ensure the same user's breaks do not overlap the requested time range
        // NOTE: allow overlaps when the incoming status is 'actual' (実績 can overlap 予定)
        if (isset($data['type']) && in_array($data['type'], ['break', 'outing'], true)) {
            $status = $data['status'] ?? 'scheduled';
            if ($status === 'actual') {
                // If creating an actual break/outing, ensure it does not overlap other actual breaks/outings
                $existsOverlapActual = ShiftDetail::where('user_id', $data['user_id'])
                    ->whereIn('type', ['break', 'outing'])
                    ->where('status', 'actual')
                    ->where(function ($q) use ($data) {
                        $q->where('start_time', '<', $data['end_time'])
                            ->where('end_time', '>', $data['start_time']);
                    })
                    ->exists();

                if ($existsOverlapActual) {
                    if ($request->expectsJson() || $request->ajax()) {
                        return response()->json([
                            'message' => '実績の休憩が他の実績休憩と重複しています。',
                            'errors' => ['start_time' => ['実績の休憩が重複しています。']],
                        ], 422);
                    }

                    return Redirect::back()->withErrors(['start_time' => '実績の休憩が重複しています。'])->withInput();
                }
            } else {
                // For non-actual (scheduled) breaks/outings, do not allow any overlap with existing breaks/outings
                $existsOverlap = ShiftDetail::where('user_id', $data['user_id'])
                    ->whereIn('type', ['break', 'outing'])
                    ->where(function ($q) use ($data) {
                        $q->where('start_time', '<', $data['end_time'])
                            ->where('end_time', '>', $data['start_time']);
                    })
                    ->exists();

                if ($existsOverlap) {
                    if ($request->expectsJson() || $request->ajax()) {
                        return response()->json([
                            'message' => '休憩時間が他の休憩と重複しています。',
                            'errors' => ['start_time' => ['休憩時間が重複しています。']],
                        ], 422);
                    }

                    return Redirect::back()->withErrors(['start_time' => '休憩時間が重複しています。'])->withInput();
                }
            }
        }

        $sd = ShiftDetail::create([
            'user_id' => $data['user_id'],
            'date' => $data['date'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'type' => $data['type'] ?? 'break',
            'status' => $data['status'] ?? 'scheduled',
        ]);

        // load related user so frontend receives user.name without extra fetch
        $sd->load('user');

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '勤務詳細を作成しました。', 'shiftDetail' => $sd], 201);
        }

        return Redirect::back()->with('success', '勤務詳細を作成しました。');
    }
    public function update(Request $request, ShiftDetail $shiftDetail)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('update', $shiftDetail);
        }

        $messages = [
            'start_time.required' => '開始日時は必須です。',
            'start_time.date_format' => '開始日時は Y-m-d H:i:s 形式で入力してください。',
            'end_time.required' => '終了日時は必須です。',
            'end_time.date_format' => '終了日時は Y-m-d H:i:s 形式で入力してください。',
            'end_time.after' => '終了日時は開始日時より後にしてください。',
        ];

        // allow updating status and type for breaks
        $messages = array_merge($messages, [
            'status.in' => '種別（status）の値が不正です。',
            'type.in' => 'タイプの値が不正です。',
        ]);

        // If client asks to adjust by delta_minutes, handle server-side arithmetic to avoid client-side formatting issues
        if ($request->has('delta_minutes')) {
            $delta = intval($request->input('delta_minutes'));

            // compute new end_time by adding delta minutes to current end_time
            try {
                $currentEnd = $shiftDetail->end_time;
                $newEnd = Carbon::parse($currentEnd)->addMinutes($delta)->format('Y-m-d H:i:s');
            } catch (\Exception $ex) {
                if ($request->expectsJson() || $request->ajax()) {
                    return response()->json(['message' => '終了時刻の計算に失敗しました。'], 422);
                }
                return Redirect::back()->withErrors(['end_time' => '終了時刻の計算に失敗しました。'])->withInput();
            }

            // perform overlap checks if this is a break
            $resultingType = $shiftDetail->type;
            if (in_array($resultingType, ['break', 'outing'], true)) {
                $status = $shiftDetail->status ?? 'scheduled';
                $userId = $shiftDetail->user_id;
                $start = $shiftDetail->start_time;
                $end = $newEnd;

                if ($status === 'actual') {
                    $existsOverlapActual = ShiftDetail::where('user_id', $userId)
                        ->whereIn('type', ['break', 'outing'])
                        ->where('status', 'actual')
                        ->where('id', '<>', $shiftDetail->id)
                        ->where(function ($q) use ($start, $end) {
                            $q->where('start_time', '<', $end)
                                ->where('end_time', '>', $start);
                        })
                        ->exists();

                    if ($existsOverlapActual) {
                        if ($request->expectsJson() || $request->ajax()) {
                            return response()->json([
                                'message' => '実績の休憩が他の実績休憩と重複しています。',
                                'errors' => ['start_time' => ['実績の休憩が重複しています。']],
                            ], 422);
                        }
                        return Redirect::back()->withErrors(['start_time' => '実績の休憩が重複しています。'])->withInput();
                    }
                } else {
                    $existsOverlap = ShiftDetail::where('user_id', $userId)
                        ->whereIn('type', ['break', 'outing'])
                        ->where('id', '<>', $shiftDetail->id)
                        ->where(function ($q) use ($start, $end) {
                            $q->where('start_time', '<', $end)
                                ->where('end_time', '>', $start);
                        })
                        ->exists();

                    if ($existsOverlap) {
                        if ($request->expectsJson() || $request->ajax()) {
                            return response()->json([
                                'message' => '休憩時間が他の休憩と重複しています。',
                                'errors' => ['start_time' => ['休憩時間が重複しています。']],
                            ], 422);
                        }
                        return Redirect::back()->withErrors(['start_time' => '休憩時間が重複しています。'])->withInput();
                    }
                }
            }

            // persist new end_time
            $shiftDetail->end_time = $newEnd;
            $shiftDetail->save();
            $shiftDetail->refresh();
            $shiftDetail->load('user');

            if ($request->expectsJson() || $request->ajax()) {
                return response()->json(['message' => '勤務詳細を更新しました。', 'shiftDetail' => $shiftDetail], 200);
            }
            return Redirect::back()->with('success', '勤務詳細を更新しました。');
        }

        $data = $request->validate([
            'start_time' => 'required|date_format:Y-m-d H:i:s',
            'end_time' => 'required|date_format:Y-m-d H:i:s|after:start_time',
            'status' => 'nullable|in:scheduled,actual,absent',
            // allow 'outing' for updates as well
            'type' => 'nullable|in:work,break,outing',
        ], $messages);

        // If the resulting record is a break, ensure no overlap with other breaks for the same user
        $resultingType = $data['type'] ?? $shiftDetail->type;
        if (in_array($resultingType, ['break', 'outing'], true)) {
            $status = $data['status'] ?? $shiftDetail->status ?? 'scheduled';
            $userId = $shiftDetail->user_id;
            $start = $data['start_time'];
            $end = $data['end_time'];

            if ($status === 'actual') {
                // When setting to actual, ensure it doesn't overlap other actual breaks
                $existsOverlapActual = ShiftDetail::where('user_id', $userId)
                    ->whereIn('type', ['break', 'outing'])
                    ->where('status', 'actual')
                    ->where('id', '<>', $shiftDetail->id)
                    ->where(function ($q) use ($start, $end) {
                        $q->where('start_time', '<', $end)
                            ->where('end_time', '>', $start);
                    })
                    ->exists();

                if ($existsOverlapActual) {
                    if ($request->expectsJson() || $request->ajax()) {
                        return response()->json([
                            'message' => '実績の休憩が他の実績休憩と重複しています。',
                            'errors' => ['start_time' => ['実績の休憩が重複しています。']],
                        ], 422);
                    }

                    return Redirect::back()->withErrors(['start_time' => '実績の休憩が重複しています。'])->withInput();
                }
            } else {
                // For scheduled (or other non-actual) ensure no overlap with any break
                $existsOverlap = ShiftDetail::where('user_id', $userId)
                    ->whereIn('type', ['break', 'outing'])
                    ->where('id', '<>', $shiftDetail->id)
                    ->where(function ($q) use ($start, $end) {
                        $q->where('start_time', '<', $end)
                            ->where('end_time', '>', $start);
                    })
                    ->exists();

                if ($existsOverlap) {
                    if ($request->expectsJson() || $request->ajax()) {
                        return response()->json([
                            'message' => '休憩時間が他の休憩と重複しています。',
                            'errors' => ['start_time' => ['休憩時間が重複しています。']],
                        ], 422);
                    }

                    return Redirect::back()->withErrors(['start_time' => '休憩時間が重複しています。'])->withInput();
                }
            }
        }
        // only update allowed fields
        $shiftDetail->fill($data);
        $shiftDetail->save();
        $shiftDetail->refresh();
        $shiftDetail->load('user');

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '勤務詳細を更新しました。', 'shiftDetail' => $shiftDetail], 200);
        }

        return Redirect::back()->with('success', '勤務詳細を更新しました。');
    }

    public function destroy(Request $request, ShiftDetail $shiftDetail)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('delete', $shiftDetail);
        }

        // capture fields before deletion
        $detailDate = $shiftDetail->date;
        $userId = $shiftDetail->user_id;
        $wasBreak = ((string) ($shiftDetail->type ?? '')) === 'break';

        $shiftDetail->delete();

        // Only delete the corresponding Shift record when the deleted detail is NOT a break.
        // Break records should not cause removal of the parent Shift.
        if (!$wasBreak && $detailDate) {
            // use whereRaw to match date-only to avoid DB driver differences
            Shift::where('user_id', $userId)->whereRaw("date(date) = ?", [$detailDate])->delete();
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '勤務詳細を削除しました。'], 200);
        }

        return Redirect::back()->with('success', '勤務詳細を削除しました。');
    }

    /**
     * Lightweight JSON endpoint to fetch shiftDetails for a date and optional user_id.
     * Used by the frontend to refresh newly-created ShiftDetail records without a full Inertia render.
     */
    public function apiIndex(Request $request)
    {
        $date = $request->get('date');
        $userId = $request->get('user_id');

        if (!$date) {
            return response()->json(['message' => 'date is required'], 400);
        }

        try {
            $d = Carbon::parse($date)->toDateString();
        } catch (\Exception $e) {
            return response()->json(['message' => 'invalid date'], 400);
        }

        $startOfDay = Carbon::parse($d)->startOfDay()->toDateTimeString();
        $endOfDay = Carbon::parse($d)->endOfDay()->toDateTimeString();

        // Get published shifts for this date
        $publishedShifts = \App\Models\Shift::where('is_published', true)
            ->whereRaw('date(date) = ?', [$d])
            ->pluck('user_id')
            ->toArray();

        // Only return shift details for users who have published shifts on this date
        $query = ShiftDetail::with('user')
            ->whereIn('user_id', $publishedShifts)
            ->where(function ($q) use ($d, $startOfDay, $endOfDay) {
                $q->whereRaw('date(date) = ?', [$d])
                    ->orWhere(function ($qq) use ($startOfDay, $endOfDay) {
                        $qq->where('start_time', '<=', $endOfDay)
                            ->where('end_time', '>=', $startOfDay);
                    });
            });

        if ($userId) {
            $query->where('user_id', $userId);
        }

        $shiftDetails = $query->get()->map(function ($sd) {
            $arr = $sd->toArray();
            $attrs = $sd->getAttributes();
            $arr['start_time'] = $attrs['start_time'] ?? null;
            $arr['end_time'] = $attrs['end_time'] ?? null;
            $arr['date'] = $attrs['date'] ?? ($arr['date'] ?? null);
            try {
                $rawDate = $attrs['date'] ?? ($arr['date'] ?? null);
                $shiftDate = $rawDate ? Carbon::parse($rawDate)->toDateString() : null;
                if ($shiftDate && isset($attrs['user_id'])) {
                    // attach shift_type from Shift table if present
                    $shiftRec = \App\Models\Shift::where('user_id', $attrs['user_id'])
                        ->whereRaw('date(date) = ?', [$shiftDate])
                        ->first();
                    $arr['shift_type'] = $shiftRec ? $shiftRec->shift_type : null;
                } else {
                    $arr['shift_type'] = null;
                }
            } catch (\Exception $e) {
                $arr['shift_type'] = null;
            }
            return $arr;
        });

        return response()->json(['shiftDetails' => $shiftDetails], 200);
    }
}
