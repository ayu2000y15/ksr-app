<?php

namespace App\Http\Controllers;

use App\Models\Shift;
use App\Models\Holiday;
use App\Models\User;
use App\Models\DefaultShift;
use App\Models\ShiftDetail;
use Carbon\Carbon;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use App\Models\ShiftApplication;

class ShiftController extends Controller
{
    public function index(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者は全て表示可
        } else {
            $this->authorize('viewAny', Shift::class);
        }

        // determine the month to display (from query param or current month)
        $month = $request->get('month') ? Carbon::parse($request->get('month')) : Carbon::now();

        // load shifts for the display month only
        $shifts = Shift::query()
            ->whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->get();

        // only include active users in the month editor
        $users = User::select('id', 'name')->where('status', 'active')->orderBy('name')->get();
        $holidays = Holiday::whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->pluck('date')
            ->map(function ($d) {
                return Carbon::parse($d)->toDateString();
            })
            ->toArray();

        // build existing shifts map: user_id => [ 'YYYY-MM-DD' => shift_type ]
        $existingShifts = [];
        foreach ($shifts as $s) {
            $uid = $s->user_id;
            $date = Carbon::parse($s->date)->toDateString();
            if (!isset($existingShifts[$uid])) $existingShifts[$uid] = [];
            $existingShifts[$uid][$date] = $s->shift_type;
        }

        // load shift_details for the month with user relation
        $shiftDetails = ShiftDetail::with('user')
            ->whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->get();

        return inertia('shifts/index', [
            'shifts' => $shifts,
            'users' => $users,
            'holidays' => $holidays,
            'existingShifts' => $existingShifts,
            'shiftDetails' => $shiftDetails,
            // upcoming shift applications (future dates only, include user relation)
            'upcomingApplications' => ShiftApplication::with('user')->where('date', '>', Carbon::now()->startOfDay())->orderBy('date', 'asc')->get(),
            'queryParams' => $request->query() ?: null,
        ]);
    }

    /**
     * Bulk update/create shifts for a month (entries: [{user_id, date, shift_type}])
     */
    public function bulkUpdate(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('create', Shift::class);
        }

        $data = $request->validate([
            'entries' => 'required|array|min:1',
            'entries.*.user_id' => 'required|exists:users,id',
            'entries.*.date' => 'required|date',
            // allow null to indicate deletion of existing shift
            'entries.*.shift_type' => 'nullable|in:day,night,leave',
        ]);

        foreach ($data['entries'] as $entry) {
            // upsert by user_id + date
            $shift = Shift::where('user_id', $entry['user_id'])->whereDate('date', $entry['date'])->first();
            if ($shift) {
                // If client cleared the value or set to leave, remove scheduled shift_details for that date
                if (is_null($entry['shift_type']) || $entry['shift_type'] === '') {
                    ShiftDetail::where('user_id', $entry['user_id'])->whereDate('date', $entry['date'])->where('status', 'scheduled')->delete();
                    $shift->delete();
                } elseif ($entry['shift_type'] === 'leave') {
                    // update to leave and remove any scheduled details
                    ShiftDetail::where('user_id', $entry['user_id'])->whereDate('date', $entry['date'])->where('status', 'scheduled')->delete();
                    $shift->update(['shift_type' => $entry['shift_type']]);
                } else {
                    // day or night: update and ensure shift_details exist
                    $shift->update(['shift_type' => $entry['shift_type']]);
                    $this->applyDefaultShiftDetails($entry['user_id'], $entry['date'], $entry['shift_type']);
                }
            } else {
                if (!is_null($entry['shift_type']) && $entry['shift_type'] !== '') {
                    $new = Shift::create([
                        'user_id' => $entry['user_id'],
                        'date' => $entry['date'],
                        'shift_type' => $entry['shift_type'],
                    ]);
                    // If leave was set, ensure there are no scheduled shift_details; otherwise create from defaults
                    if ($entry['shift_type'] === 'leave') {
                        ShiftDetail::where('user_id', $entry['user_id'])->whereDate('date', $entry['date'])->where('status', 'scheduled')->delete();
                    } else {
                        $this->applyDefaultShiftDetails($entry['user_id'], $entry['date'], $entry['shift_type']);
                    }
                }
            }
        }

        // If request expects JSON (axios/ajax), return a JSON response so frontend can handle it.
        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => 'シフトを更新しました。'], 200);
        }

        return Redirect::route('shifts.index')->with('success', 'シフトを更新しました。');
    }

    /**
     * Mark a single user's date as break/leave immediately.
     * Creates or updates Shift to 'leave' and adds a ShiftDetail of type 'break' with empty times.
     */
    public function markBreak(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('create', Shift::class);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        $shift = Shift::where('user_id', $data['user_id'])->whereDate('date', $data['date'])->first();
        if ($shift) {
            $shift->update(['shift_type' => 'leave']);
        } else {
            $shift = Shift::create(['user_id' => $data['user_id'], 'date' => $data['date'], 'shift_type' => 'leave']);
        }

        // For a leave day, remove any scheduled shift_details for that user/date
        ShiftDetail::where('user_id', $data['user_id'])->whereDate('date', $data['date'])->where('status', 'scheduled')->delete();

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '休に変更しました。'], 200);
        }

        return Redirect::back()->with('success', '休に変更しました。');
    }

    /**
     * Cancel a previously marked leave for a user/date.
     * Deletes the Shift record (if any) and reapplies default shift_details for that date.
     */
    public function unmarkBreak(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('create', Shift::class);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        $shift = Shift::where('user_id', $data['user_id'])->where('date', $data['date'])->first();
        if ($shift) {
            $shift->delete();
        }

        // After removing the explicit leave shift, attempt to reapply default shift details for that date
        // (this will create scheduled ShiftDetail entries if defaults exist for the weekday)
        try {
            $this->applyDefaultShiftDetails($data['user_id'], $data['date'], 'day');
        } catch (\Exception $e) {
            // ignore failures here; default details are best-effort
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '休を解除しました。'], 200);
        }

        return Redirect::back()->with('success', '休を解除しました。');
    }

    /**
     * Find DefaultShift(s) matching weekday and shift_type, then create ShiftDetail records
     * If matching default shift exists, register a single 'work' ShiftDetail covering start/end.
     */
    protected function applyDefaultShiftDetails(int $userId, string $date, string $shiftType)
    {
        // determine weekday 0=Sunday..6=Saturday
        $d = Carbon::parse($date);
        $weekday = (int) $d->dayOfWeek;

        // find default shifts for weekday and shift_type
        $defaults = DefaultShift::where('day_of_week', $weekday)->where('shift_type', $shiftType)->get();
        if ($defaults->isEmpty()) return;

        // remove existing scheduled details for that user/date to avoid duplicates
        ShiftDetail::where('user_id', $userId)->whereDate('date', $date)->where('status', 'scheduled')->delete();

        foreach ($defaults as $df) {
            // build datetime for start/end using the date and default's time (HH:MM)
            $start = Carbon::parse($date . ' ' . $df->start_time);
            $end = Carbon::parse($date . ' ' . $df->end_time);
            // if end is before/equals start, assume shift crosses midnight -> add one day to end
            if ($end->lessThanOrEqualTo($start)) {
                $end->addDay();
            }

            ShiftDetail::create([
                'user_id' => $userId,
                'date' => $date,
                'type' => 'work',
                'start_time' => $start->toDateTimeString(),
                'end_time' => $end->toDateTimeString(),
                'status' => 'scheduled',
            ]);
        }
    }

    public function create()
    {
        // show the Inertia page for creating a shift
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('create', Shift::class);
        }

        return inertia('shifts/create');
    }

    public function store(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('create', Shift::class);
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
        ], $messages);

        $shift = Shift::create($data);

        return Redirect::route('shifts.index')->with('success', 'シフトを作成しました。');
    }

    public function show(Shift $shift)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('view', $shift);
        }

        $shift->load('breaks');
        return inertia('shifts/show', ['shift' => $shift]);
    }

    public function edit(Shift $shift)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('update', $shift);
        }

        $shift->load('breaks');
        return inertia('shifts/edit', ['shift' => $shift]);
    }

    public function update(Request $request, Shift $shift)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('update', $shift);
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

        $shift->update($data);

        return Redirect::route('shifts.index')->with('success', 'シフトを更新しました。');
    }

    public function destroy(Shift $shift)
    {
        if (Auth::user()->hasRole('システム管理者')) {
        } else {
            $this->authorize('delete', $shift);
        }

        $shift->delete();
        return Redirect::route('shifts.index')->with('success', 'シフトを削除しました。');
    }
}
