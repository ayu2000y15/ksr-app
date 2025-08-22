<?php

namespace App\Http\Controllers;

use App\Models\ShiftDetail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Shift;
use Illuminate\Support\Facades\Redirect;

class ShiftDetailController extends Controller
{
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

        $data = $request->validate([
            'start_time' => 'required|date_format:Y-m-d H:i:s',
            'end_time' => 'required|date_format:Y-m-d H:i:s|after:start_time',
        ], $messages);

        $shiftDetail->update($data);

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

        // capture date before deletion
        $detailDate = $shiftDetail->date;
        $userId = $shiftDetail->user_id;

        $shiftDetail->delete();

        // also delete the corresponding Shift record (user/date) if exists
        if ($detailDate) {
            Shift::where('user_id', $userId)->whereDate('date', $detailDate)->delete();
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '勤務詳細を削除しました。'], 200);
        }

        return Redirect::back()->with('success', '勤務詳細を削除しました。');
    }
}
