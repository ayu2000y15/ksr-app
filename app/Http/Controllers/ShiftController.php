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
            // include default shift patterns so frontend can determine which shift types are available per weekday/holiday
            'defaultShifts' => DefaultShift::all(),
            'queryParams' => $request->query() ?: null,
        ]);
    }

    /**
     * Return a dedicated daily timeline page for a single date.
     * Accepts ?date=YYYY-MM-DD and returns shiftDetails filtered to that date.
     */
    public function daily(Request $request)
    {
        try {
            $this->authorize('viewAny', Shift::class);
        } catch (\Exception $e) {
            // don't block the response for now; log for diagnosis
            logger()->debug('ShiftController::daily authorize failed: ' . $e->getMessage());
        }

        $date = $request->get('date');
        if (!$date) {
            // If no date provided, redirect back to index
            return Redirect::route('shifts.index');
        }

        // ensure date string is canonical
        try {
            $d = Carbon::parse($date)->toDateString();
        } catch (\Exception $e) {
            return Redirect::route('shifts.index');
        }

        // fetch shift details that belong to the requested date.
        // We include rows where the `date` column equals the day, and also
        // any shift_details whose start_time or end_time fall within the day
        // (this captures cross-midnight shifts that span the day).
        $startOfDay = Carbon::parse($d)->startOfDay()->toDateTimeString();
        $endOfDay = Carbon::parse($d)->endOfDay()->toDateTimeString();

        $shiftDetails = ShiftDetail::with('user')
            ->where(function ($q) use ($d, $startOfDay, $endOfDay) {
                // match if the date column equals the day
                $q->whereRaw('date(date) = ?', [$d])
                    // OR if the shift interval overlaps the day window
                    ->orWhere(function ($qq) use ($startOfDay, $endOfDay) {
                        $qq->where('start_time', '<=', $endOfDay)
                            ->where('end_time', '>=', $startOfDay);
                    });
            })
            ->get();

        // Ensure we pass the raw DB-stored datetime strings (not Carbon instances)
        $shiftDetails = $shiftDetails->map(function ($sd) {
            $arr = $sd->toArray();
            $attrs = $sd->getAttributes();
            // override start_time/end_time/date with raw DB values if present
            $arr['start_time'] = $attrs['start_time'] ?? null;
            $arr['end_time'] = $attrs['end_time'] ?? null;
            $arr['date'] = $attrs['date'] ?? ($arr['date'] ?? null);
            // attach shift_type from shifts table for the same user/date (use DB-stored date)
            try {
                $rawDate = $attrs['date'] ?? ($arr['date'] ?? null);
                $shiftDate = $rawDate ? Carbon::parse($rawDate)->toDateString() : null;
                if ($shiftDate && isset($attrs['user_id'])) {
                    $shiftRec = Shift::where('user_id', $attrs['user_id'])->whereRaw('date(date) = ?', [$shiftDate])->first();
                    $arr['shift_type'] = $shiftRec ? $shiftRec->shift_type : null;
                } else {
                    $arr['shift_type'] = null;
                }
            } catch (\Exception $e) {
                $arr['shift_type'] = null;
            }
            return $arr;
        });

        // (debug removed)

        return Inertia::render('shifts/daily', [
            'date' => $d,
            'shiftDetails' => $shiftDetails,
            // include active users so the daily page can show a user picker for quick-add
            'users' => User::select('id', 'name', 'status')->where('status', 'active')->orderBy('id')->get(),
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
            $shift = Shift::where('user_id', $entry['user_id'])->whereRaw('date(date) = ?', [$entry['date']])->first();
            if ($shift) {
                // If client cleared the value or set to leave, remove scheduled shift_details for that date
                if (is_null($entry['shift_type']) || $entry['shift_type'] === '') {
                    // remove all shift details for that user/date (work, break, etc.) when clearing the shift
                    ShiftDetail::where('user_id', $entry['user_id'])->whereRaw('date(date) = ?', [$entry['date']])->delete();
                    $shift->delete();
                } elseif ($entry['shift_type'] === 'leave') {
                    // update to leave and remove any existing details for that date (including breaks)
                    ShiftDetail::where('user_id', $entry['user_id'])->whereRaw('date(date) = ?', [$entry['date']])->delete();
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
                        // ensure no shift_details remain for this date when marking as leave
                        ShiftDetail::where('user_id', $entry['user_id'])->whereRaw('date(date) = ?', [$entry['date']])->delete();
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

        $shift = Shift::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->first();
        if ($shift) {
            $shift->update(['shift_type' => 'leave']);
        } else {
            $shift = Shift::create(['user_id' => $data['user_id'], 'date' => $data['date'], 'shift_type' => 'leave']);
        }

        // For a leave day, remove any shift_details for that user/date (work, break, scheduled, actual)
        ShiftDetail::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->delete();

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
        // If no defaults exist, create a placeholder scheduled work ShiftDetail from 00:00 to 00:00
        if ($defaults->isEmpty()) {
            // remove existing details for that user/date to avoid duplicates (delete all types: work, break, etc.)
            ShiftDetail::where('user_id', $userId)->whereRaw('date(date) = ?', [$date])->delete();

            $zero = Carbon::parse($date . ' 00:00:00')->toDateTimeString();
            ShiftDetail::create([
                'user_id' => $userId,
                'date' => $date,
                'type' => 'work',
                'start_time' => $zero,
                'end_time' => $zero,
                'status' => 'scheduled',
            ]);

            return;
        }

        // remove existing details for that user/date to avoid duplicates (delete all types: work, break, etc.)
        ShiftDetail::where('user_id', $userId)->whereRaw('date(date) = ?', [$date])->delete();

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

    /**
     * Toggle confirmation for all work ShiftDetails on a given date.
     * POST params: date=YYYY-MM-DD, action=confirm|unconfirm (optional; toggles when absent)
     */
    public function toggleConfirmDate(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('update', Shift::class);
        }

        $data = $request->validate([
            'date' => 'required|date',
            'action' => 'nullable|in:confirm,unconfirm',
        ]);

        $date = Carbon::parse($data['date'])->toDateString();
        $action = $data['action'] ?? null;

        // find all work ShiftDetails for the calendar date (use date column)
        $workDetails = ShiftDetail::whereRaw('date(date) = ?', [$date])->where('type', 'work')->get();

        if ($workDetails->isEmpty()) {
            return response()->json(['message' => '対象の勤務詳細が見つかりませんでした。', 'confirmed' => false], 200);
        }

        // decide target status: if action specified, use it; otherwise toggle based on whether any scheduled exist
        $hasScheduled = $workDetails->contains(function ($d) {
            return $d->status === 'scheduled';
        });
        $hasActual = $workDetails->contains(function ($d) {
            return $d->status === 'actual';
        });

        if ($action === 'confirm') {
            $targetStatus = 'actual';
        } elseif ($action === 'unconfirm') {
            $targetStatus = 'scheduled';
        } else {
            // toggle: if there are scheduled entries, confirm them; else unconfirm
            $targetStatus = $hasScheduled ? 'actual' : 'scheduled';
        }

        // perform update in transaction
        \DB::transaction(function () use ($workDetails, $targetStatus) {
            if ($targetStatus === 'actual') {
                // confirming: only change scheduled -> actual. Leave absent untouched.
                foreach ($workDetails as $d) {
                    if ($d->type === 'work' && $d->status === 'scheduled') {
                        $d->status = 'actual';
                        $d->save();
                    }
                }
            } else {
                // unconfirming: only change actual -> scheduled. Leave absent untouched.
                foreach ($workDetails as $d) {
                    if ($d->type === 'work' && $d->status === 'actual') {
                        $d->status = 'scheduled';
                        $d->save();
                    }
                }
            }
        });

        return response()->json(['message' => $targetStatus === 'actual' ? '勤務を確定しました。' : '勤務の確定を解除しました。', 'confirmed' => $targetStatus === 'actual'], 200);
    }
}
