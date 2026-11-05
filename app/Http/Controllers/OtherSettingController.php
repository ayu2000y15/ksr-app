<?php

namespace App\Http\Controllers;

use App\Models\ShiftSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;

/**
 * 各種設定 > その他（グローバル設定）。
 * 現在は「休暇申請ボタンを表示する日数（対象日の N 日前まで表示）」を管理する。
 * システム管理者のみアクセス可能。
 */
class OtherSettingController extends Controller
{
    /**
     * 各種申請ページの注意書きの初期値（HTML）。
     * 「その他」ページで編集・保存されると、この初期値に代わってDBの値が使用される。
     */
    public const DEFAULT_SHIFT_APPLICATIONS_NOTICE = <<<'HTML'
<p>・<strong>「残りの休暇」</strong>を超えての登録はできません。</p>
<p>・<strong>休暇申請</strong>は期限までに行ってください。</p>
<p>・土日祝日は基本的に出勤していただきますが、事情がある場合は社員に直接連絡してください。</p>
<p>・その他やむを得ない事情がある場合、社員に直接連絡してください。</p>
<p>・<strong>中抜け申請</strong>は前日までに行ってください。当日の申請はできません。</p>
<p>・<strong>食券不要申請</strong>は2日前までに行ってください。それ以降は受け付けません。</p>
HTML;

    private function authorizeAdmin(): void
    {
        if (! Auth::user() || ! Auth::user()->hasRole('システム管理者')) {
            abort(403);
        }
    }

    public function index()
    {
        $this->authorizeAdmin();

        $setting = ShiftSetting::first();

        $notice = $setting && $setting->shift_applications_notice !== null && $setting->shift_applications_notice !== ''
            ? $setting->shift_applications_notice
            : self::DEFAULT_SHIFT_APPLICATIONS_NOTICE;

        return inertia('admin/other-settings', [
            // 対象日の N 日前まで休暇申請ボタンを表示。0 の場合は全期間表示。
            'leave_request_deadline_days' => $setting ? (int) $setting->apply_deadline_days : 14,
            // 各種申請ページの注意書き（HTML）
            'shift_applications_notice' => $notice,
        ]);
    }

    public function update(Request $request)
    {
        $this->authorizeAdmin();

        $data = $request->validate([
            'leave_request_deadline_days' => 'required|integer|min:0|max:365',
            'shift_applications_notice' => 'nullable|string|max:20000',
        ], [
            'leave_request_deadline_days.required' => '日数を入力してください。',
            'leave_request_deadline_days.integer' => '日数は整数で入力してください。',
            'leave_request_deadline_days.min' => '日数は0以上で入力してください。',
            'leave_request_deadline_days.max' => '日数は365以下で入力してください。',
            'shift_applications_notice.max' => '注意書きが長すぎます。',
        ]);

        // shift_settings はシングルトン（1行）として扱う。
        $setting = ShiftSetting::first() ?: new ShiftSetting();
        $setting->apply_deadline_days = (int) $data['leave_request_deadline_days'];
        $setting->shift_applications_notice = $data['shift_applications_notice'] ?? null;
        $setting->save();

        return Redirect::route('admin.other-settings.index')->with('success', '設定を保存しました。');
    }
}
