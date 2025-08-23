<?php

namespace App\Http\Controllers;

use App\Models\ShiftDetail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Shift;
use Illuminate\Support\Facades\Redirect;

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
            'type' => 'nullable|in:work,break',
            'status' => 'nullable|in:scheduled,actual,absent',
        ], $messages);

        // If this is a break, ensure the same user's breaks do not overlap the requested time range
        // NOTE: allow overlaps when the incoming status is 'actual' (実績 can overlap 予定)
        if (isset($data['type']) && $data['type'] === 'break') {
            $status = $data['status'] ?? 'scheduled';
            if ($status !== 'actual') {
                $existsOverlap = ShiftDetail::where('user_id', $data['user_id'])
                    ->where('type', 'break')
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

        $data = $request->validate([
            'start_time' => 'required|date_format:Y-m-d H:i:s',
            'end_time' => 'required|date_format:Y-m-d H:i:s|after:start_time',
            'status' => 'nullable|in:scheduled,actual,absent',
            'type' => 'nullable|in:work,break',
        ], $messages);

        // If the resulting record is a break, ensure no overlap with other breaks for the same user
        $resultingType = $data['type'] ?? $shiftDetail->type;
        if ($resultingType === 'break') {
            // If the updated/remaining status is 'actual', allow overlaps
            $status = $data['status'] ?? $shiftDetail->status ?? 'scheduled';
            if ($status !== 'actual') {
                $userId = $shiftDetail->user_id;
                $start = $data['start_time'];
                $end = $data['end_time'];

                $existsOverlap = ShiftDetail::where('user_id', $userId)
                    ->where('type', 'break')
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
}
