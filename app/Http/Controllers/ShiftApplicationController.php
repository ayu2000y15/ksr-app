<?php

namespace App\Http\Controllers;

use App\Models\ShiftApplication;
use App\Models\Holiday;
use App\Models\UserShiftSetting;
use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Carbon\Carbon;

class ShiftApplicationController extends Controller
{
    public function index(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('viewAny', ShiftApplication::class);
        }

        // month selection for calendar view (default to current month)
        $month = $request->get('month') ? Carbon::parse($request->get('month')) : Carbon::now();

        // current user (used both for filtering and leave calculations)
        $user = Auth::user();

        // Show only current user's applications unless system admin
        $sort = $request->get('sort', 'date');
        $direction = strtolower($request->get('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['id', 'date'];
        if (!in_array($sort, $allowedSorts)) {
            $sort = 'date';
        }

        if (Auth::user()->hasRole('システム管理者')) {
            $applications = ShiftApplication::with('user')->orderBy($sort, $direction)->simplePaginate(50)->withQueryString();
        } else {
            $applications = ShiftApplication::with('user')->where('user_id', $user->id)->orderBy($sort, $direction)->simplePaginate(50)->withQueryString();
        }

        // holidays in the month
        $holidays = Holiday::whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->pluck('date')
            ->map(function ($d) {
                return Carbon::parse($d)->toDateString();
            })
            ->toArray();

        // current user's monthly leave settings & usage
        $user = Auth::user();
        $setting = UserShiftSetting::where('user_id', $user->id)->first();
        $monthlyLimit = $setting ? (int) $setting->monthly_leave_limit : 0; // 0 => unlimited

        $usedLeaves = Shift::where('user_id', $user->id)
            ->where('shift_type', 'leave')
            ->whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->count();

        $remaining = $monthlyLimit === 0 ? null : max(0, $monthlyLimit - $usedLeaves);

        $deadlineDays = (int) config('shift.application_deadline_days', 0);

        // collect current user's leave dates in the month for calendar marking
        $userLeaves = Shift::where('user_id', $user->id)->where('shift_type', 'leave')
            ->whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->pluck('date')
            ->map(function ($d) {
                return Carbon::parse($d)->toDateString();
            })->toArray();

        // collect any shift dates (any shift_type) for current user in the month so frontend can disable application where a shift already exists
        $userShiftDates = Shift::where('user_id', $user->id)
            ->whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->pluck('date')
            ->map(function ($d) {
                return Carbon::parse($d)->toDateString();
            })->toArray();

        // collect scheduled shift details for the month for the current user (used to display times on calendar)
        $shiftDetails = \App\Models\ShiftDetail::where('user_id', $user->id)
            ->whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->get(['date', 'start_time', 'end_time'])
            ->map(function ($sd) use ($user) {
                $dateStr = Carbon::parse($sd->date)->toDateString();
                $attrs = $sd->getAttributes();
                // find shift record for this user/date to expose shift_type and step_out
                try {
                    $shiftRec = \App\Models\Shift::where('user_id', $user->id)->whereRaw('date(date) = ?', [$dateStr])->first();
                    $shiftType = $shiftRec ? $shiftRec->shift_type : null;
                    $stepOut = $shiftRec ? ($shiftRec->step_out ?? 0) : 0;
                } catch (\Exception $e) {
                    $shiftType = null;
                    $stepOut = 0;
                }

                return [
                    'date' => $dateStr,
                    'start_time' => $attrs['start_time'] ? Carbon::parse($attrs['start_time'])->format('H:i:s') : null,
                    'end_time' => $attrs['end_time'] ? Carbon::parse($attrs['end_time'])->format('H:i:s') : null,
                    'shift_type' => $shiftType,
                    'step_out' => $stepOut,
                ];
            })->toArray();

        return inertia('shift-applications/index', [
            'applications' => $applications,
            'queryParams' => $request->query() ?: null,
            'month' => $month->toDateString(),
            'holidays' => $holidays,
            'currentUserLeave' => [
                'monthly_leave_limit' => $monthlyLimit,
                'used' => $usedLeaves,
                'remaining' => $remaining,
            ],
            'application_deadline_days' => $deadlineDays,
            'userLeaves' => $userLeaves,
            'userShiftDates' => $userShiftDates,
            'shiftDetails' => $shiftDetails,
        ]);
    }

    public function create()
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('create', ShiftApplication::class);
        }

        return inertia('shift-applications/create');
    }

    public function store(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('create', ShiftApplication::class);
        }

        $messages = [
            'user_id.required' => 'ユーザーを選択してください。',
            'user_id.exists' => '指定されたユーザーが存在しません。',
            'date.required' => '日付は必須です。',
            'date.date' => '有効な日付を入力してください。',
            'reason.string' => '理由は文字列で入力してください。',
        ];

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'type' => 'nullable|string',
            'reason' => 'nullable|string',
        ], $messages);

        // 申請期限チェック: config/shift.php の application_deadline_days を参照
        // 値が 0 の場合は制限なし。管理者（システム管理者）は制限を無視します。
        // Use only the date part to avoid timezone/time shifting (incoming ISO datetimes may include TZ)
        $targetDateString = Carbon::parse($data['date'])->toDateString(); // YYYY-MM-DD
        $target = Carbon::createFromFormat('Y-m-d', $targetDateString)->startOfDay();
        $today = Carbon::today();

        if ($target->lt($today)) {
            return Redirect::back()->withErrors(['date' => '過去の日付には申請できません。'])->withInput();
        }

        $data['status'] = 'pending';

        $app = ShiftApplication::create($data);

        // If the request is an Inertia request (X-Inertia header), return a Redirect so Inertia can handle it.
        // For plain AJAX callers that expect JSON, return the created resource.
        if ($request->header('X-Inertia')) {
            return Redirect::route('shift-applications.index')->with('success', '休暇申請を作成しました。');
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json($app->load('user'), 201);
        }

        return Redirect::route('shift-applications.index')->with('success', '休暇申請を作成しました。');
    }

    public function show(ShiftApplication $shiftApplication)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('view', $shiftApplication);
        }

        return inertia('shift-applications/show', ['application' => $shiftApplication]);
    }

    public function update(Request $request, ShiftApplication $shiftApplication)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('update', $shiftApplication);
        }

        $messages = [
            'status.required' => 'ステータスは必須です。',
            'status.in' => '無効なステータスが選択されました。',
        ];

        $data = $request->validate([
            'status' => 'required|in:pending,approved,rejected',
            'type' => 'nullable|string',
        ], $messages);

        // capture old status to decide post-update actions
        $oldStatus = $shiftApplication->status;

        $shiftApplication->update($data);

        // If application became approved and is type 'leave', create/update Shift record
        $newStatus = $data['status'] ?? $shiftApplication->status;
        $newType = $data['type'] ?? $shiftApplication->type;

        try {
            if ($oldStatus !== 'approved' && $newStatus === 'approved' && $newType === 'leave') {
                // create or update a Shift to 'leave' for the user/date
                \App\Models\Shift::updateOrCreate(
                    ['user_id' => $shiftApplication->user_id, 'date' => $shiftApplication->date],
                    ['shift_type' => 'leave']
                );
                // remove any shift_details for that user/date to reflect leave
                \App\Models\ShiftDetail::where('user_id', $shiftApplication->user_id)->whereRaw('date(date) = ?', [Carbon::parse($shiftApplication->date)->toDateString()])->delete();
            }

            // If it was approved before and now is not approved, and it was a leave, remove the Shift record
            if ($oldStatus === 'approved' && $newStatus !== 'approved' && ($shiftApplication->type ?? $newType) === 'leave') {
                $shift = \App\Models\Shift::where('user_id', $shiftApplication->user_id)->whereRaw('date(date) = ?', [Carbon::parse($shiftApplication->date)->toDateString()])->first();
                if ($shift && $shift->shift_type === 'leave') {
                    $shift->delete();
                }
            }
        } catch (\Exception $e) {
            // avoid breaking update flow; log for diagnosis
            logger()->error('ShiftApplication post-update hook failed: ' . $e->getMessage());
        }

        return Redirect::route('shift-applications.index')->with('success', '休暇申請を更新しました。');
    }

    public function destroy(ShiftApplication $shiftApplication)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('delete', $shiftApplication);
        }

        $shiftApplication->delete();
        return Redirect::route('shift-applications.index')->with('success', '休暇申請を削除しました。');
    }
}
