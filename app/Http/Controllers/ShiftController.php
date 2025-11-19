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

        // only include active users in the month editor (prefer position ordering then id)
        $users = User::select('id', 'name', 'position', 'preferred_week_days')->where('status', 'active')->orderBy('position')->orderBy('id')->get();
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
            ->get()
            ->map(function ($sd) {
                $arr = $sd->toArray();
                $attrs = $sd->getAttributes();
                // override raw values
                $arr['start_time'] = $attrs['start_time'] ?? null;
                $arr['end_time'] = $attrs['end_time'] ?? null;
                $arr['date'] = $attrs['date'] ?? ($arr['date'] ?? null);
                // attach shift_type and step_out from shifts table for the same user/date
                try {
                    $rawDate = $attrs['date'] ?? ($arr['date'] ?? null);
                    $shiftDate = $rawDate ? Carbon::parse($rawDate)->toDateString() : null;
                    if ($shiftDate && isset($attrs['user_id'])) {
                        $shiftRec = Shift::where('user_id', $attrs['user_id'])->whereRaw('date(date) = ?', [$shiftDate])->first();
                        $arr['shift_type'] = $shiftRec ? $shiftRec->shift_type : null;
                        $arr['step_out'] = $shiftRec ? ($shiftRec->step_out ?? 0) : 0;
                        $arr['position'] = $shiftRec ? ($shiftRec->position ?? null) : null;
                    } else {
                        $arr['shift_type'] = null;
                        $arr['step_out'] = 0;
                        $arr['position'] = null;
                    }
                } catch (\Exception $e) {
                    $arr['shift_type'] = null;
                    $arr['step_out'] = 0;
                }
                return $arr;
            });

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
            // attach shift_type and step_out from shifts table for the same user/date
            try {
                $rawDate = $attrs['date'] ?? ($arr['date'] ?? null);
                $shiftDate = $rawDate ? Carbon::parse($rawDate)->toDateString() : null;
                if ($shiftDate && isset($attrs['user_id'])) {
                    $shiftRec = Shift::where('user_id', $attrs['user_id'])->whereRaw('date(date) = ?', [$shiftDate])->first();
                    $arr['shift_type'] = $shiftRec ? $shiftRec->shift_type : null;
                    $arr['step_out'] = $shiftRec ? ($shiftRec->step_out ?? 0) : 0;
                    $arr['position'] = $shiftRec ? ($shiftRec->position ?? null) : null;
                } else {
                    $arr['shift_type'] = null;
                    $arr['step_out'] = 0;
                    $arr['position'] = null;
                }
            } catch (\Exception $e) {
                $arr['shift_type'] = null;
                $arr['step_out'] = 0;
            }
            return $arr;
        });

        // (debug removed)

        return Inertia::render('shifts/daily', [
            'date' => $d,
            'shiftDetails' => $shiftDetails,
            // include active users so the daily page can show a user picker for quick-add
            'users' => User::select('id', 'name', 'status', 'position')->where('status', 'active')->orderBy('position')->orderBy('id')->get(),
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
            // Check if this date falls on a user's preferred holiday weekday
            $user = User::find($entry['user_id']);
            if (!$user) {
                continue;
            }

            $dateObj = Carbon::parse($entry['date']);
            $weekday = (int) $dateObj->dayOfWeek;

            // Parse preferred weekly holidays (same logic as autoRegisterEmploymentPeriod)
            $prefsRaw = $user->preferred_week_days ?? [];
            if (!is_array($prefsRaw) && is_string($prefsRaw)) {
                $decoded = json_decode($prefsRaw, true);
                $prefs = is_array($decoded) ? $decoded : [$prefsRaw];
            } elseif (is_array($prefsRaw)) {
                $prefs = $prefsRaw;
            } else {
                $prefs = (array) $prefsRaw;
            }

            // Normalize preferred weekdays to integers (0-6)
            $preferredHolidayWeekdays = [];
            foreach ($prefs as $wk) {
                $wkInt = null;
                if (is_numeric($wk)) {
                    $wkInt = (int) $wk;
                } else {
                    $s = strtolower(trim((string) $wk));
                    $map = [
                        'sun' => 0,
                        'sunday' => 0,
                        '日' => 0,
                        'mon' => 1,
                        'monday' => 1,
                        '月' => 1,
                        'tue' => 2,
                        'tues' => 2,
                        'tuesday' => 2,
                        '火' => 2,
                        'wed' => 3,
                        'wednesday' => 3,
                        '水' => 3,
                        'thu' => 4,
                        'thurs' => 4,
                        'thursday' => 4,
                        '木' => 4,
                        'fri' => 5,
                        'friday' => 5,
                        '金' => 5,
                        'sat' => 6,
                        'saturday' => 6,
                        '土' => 6,
                    ];
                    if (isset($map[$s])) $wkInt = $map[$s];
                }
                if ($wkInt !== null) {
                    $preferredHolidayWeekdays[] = $wkInt;
                }
            }

            // Skip if this weekday is a preferred holiday (same logic as autoRegisterEmploymentPeriod)
            if (in_array($weekday, $preferredHolidayWeekdays, true)) {
                // Remove existing shift and details for this date
                $existingShift = Shift::where('user_id', $entry['user_id'])->whereRaw('date(date) = ?', [$entry['date']])->first();
                if ($existingShift) {
                    ShiftDetail::where('user_id', $entry['user_id'])->whereRaw('date(date) = ?', [$entry['date']])->delete();
                    $existingShift->delete();
                }
                continue;
            }

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
        } elseif (Auth::user()->hasPermissionTo('shift_application.create')) {
            // allow when user has the shift_application.create permission (align with frontend)
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
     * Mark a single user's date as step-out (中抜け) immediately.
     * Creates or updates Shift to set step_out = 1. Does not change shift_type.
     */
    public function markStepOut(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } elseif (Auth::user()->hasPermissionTo('shift_application.create')) {
            // allow with shift_application.create permission
        } else {
            $this->authorize('create', Shift::class);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        $shift = Shift::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->first();
        if ($shift) {
            $shift->update(['step_out' => 1]);
        } else {
            // create a shift record with default shift_type as 'day' if unknown, but keep step_out = 1
            $shift = Shift::create(['user_id' => $data['user_id'], 'date' => $data['date'], 'shift_type' => 'day', 'step_out' => 1]);
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '中抜けに変更しました。'], 200);
        }

        return Redirect::back()->with('success', '中抜けに変更しました。');
    }

    /**
     * Set a per-shift position marker (e.g. 'snowboard'|'ski') for a user/date.
     * Expects POST: user_id, date, position (string|null). Returns JSON on AJAX.
     */
    public function markPosition(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } elseif (Auth::user()->hasPermissionTo('shift_application.create')) {
            // allow with permission
        } else {
            $this->authorize('update', Shift::class);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'position' => 'nullable|string',
        ]);

        $shift = Shift::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->first();
        if ($shift) {
            $shift->update(['position' => $data['position']]);
        } else {
            // create a default day shift if needed and set position
            $shift = Shift::create(['user_id' => $data['user_id'], 'date' => $data['date'], 'shift_type' => 'day', 'position' => $data['position']]);
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => 'ポジションを更新しました。', 'position' => $shift->position], 200);
        }

        return Redirect::back()->with('success', 'ポジションを更新しました。');
    }

    /**
     * Mark a single user's date as meal_ticket = 0 (食券不要)
     */
    public function markMealTicket(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } elseif (Auth::user()->hasPermissionTo('shift_application.create')) {
            // allow with shift_application.create permission
        } else {
            $this->authorize('update', Shift::class);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        $shift = Shift::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->first();
        if ($shift) {
            $shift->update(['meal_ticket' => 0]);
        } else {
            // create a default day shift and set meal_ticket=0
            $shift = Shift::create(['user_id' => $data['user_id'], 'date' => $data['date'], 'shift_type' => 'day', 'meal_ticket' => 0]);
        }

        // create a ShiftApplication record to record this change
        try {
            ShiftApplication::create([
                'user_id' => $data['user_id'],
                'date' => $data['date'],
                'type' => 'meal_ticket',
                'status' => 'approved',
                'reason' => '食券不要',
            ]);
        } catch (\Exception $e) {
            // ignore failures in application recording
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '食券不要に設定しました。'], 200);
        }

        return Redirect::back()->with('success', '食券不要に設定しました。');
    }

    /**
     * Unmark meal_ticket (set back to 1)
     */
    public function unmarkMealTicket(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } elseif (Auth::user()->hasPermissionTo('shift_application.create')) {
            // allow with shift_application.create permission
        } else {
            $this->authorize('update', Shift::class);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        $shift = Shift::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->first();
        if ($shift) {
            $shift->update(['meal_ticket' => 1]);
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '食券設定を解除しました。'], 200);
        }

        return Redirect::back()->with('success', '食券設定を解除しました。');
    }

    /**
     * Cancel a previously marked step-out for a user/date.
     */
    public function unmarkStepOut(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } elseif (Auth::user()->hasPermissionTo('shift_application.create')) {
            // allow with shift_application.create permission
        } else {
            $this->authorize('create', Shift::class);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
        ]);

        $shift = Shift::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->first();
        if ($shift) {
            $shift->update(['step_out' => 0]);
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['message' => '中抜けを解除しました。'], 200);
        }

        return Redirect::back()->with('success', '中抜けを解除しました。');
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

        // remove any explicit Shift record for the date
        $shift = Shift::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [$data['date']])->first();
        if ($shift) {
            $shift->delete();
        }

        // Also remove any ShiftDetail rows tied to that user/date so nothing remains linked
        // (use raw date comparison to ignore DB time portion)
        try {
            ShiftDetail::where('user_id', $data['user_id'])->whereRaw('date(date) = ?', [Carbon::parse($data['date'])->toDateString()])->delete();
        } catch (\Exception $e) {
            // ignore failures here but log for diagnosis
            logger()->error('Failed to delete ShiftDetail on unmarkBreak: ' . $e->getMessage());
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

        // Check if the date is a holiday
        $isHoliday = Holiday::where('date', $date)->exists();
        $patternType = $isHoliday ? 'holiday' : 'weekday';

        // find default shifts for weekday, shift_type, and type (holiday/weekday)
        $defaults = DefaultShift::where('day_of_week', $weekday)
            ->where('shift_type', $shiftType)
            ->where('type', $patternType)
            ->get();
        // remove existing details for that user/date to avoid duplicates (delete all types: work, break, etc.)
        ShiftDetail::where('user_id', $userId)->whereRaw('date(date) = ?', [$date])->delete();

        // If the user has default start/end times configured, prefer those and create a single work detail
        try {
            $user = User::find($userId);
            $uStart = $user && !empty($user->default_start_time) ? $user->default_start_time : null;
            $uEnd = $user && !empty($user->default_end_time) ? $user->default_end_time : null;

            // 00:00:00の場合は空とみなす
            if ($uStart === '00:00:00' || $uStart === '00:00') {
                $uStart = null;
            }
            if ($uEnd === '00:00:00' || $uEnd === '00:00') {
                $uEnd = null;
            }

            if ($uStart && $uEnd) {
                $start = Carbon::parse($date . ' ' . $uStart);
                $end = Carbon::parse($date . ' ' . $uEnd);
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

                return;
            }
        } catch (\Exception $e) {
            // ignore and fall back to default pattern behavior below
        }

        // If no user defaults, fall back to default shift patterns. If none exist, create a zero-length placeholder.
        if ($defaults->isEmpty()) {
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

    /**
     * Apply users' preferred weekly holidays for a given month.
     * Expects POST param: month=YYYY-MM-01 (first day of month recommended)
     * For each active user with preferred_week_days (array of 0..6), create or update Shift to 'leave'
     */
    public function applyPreferredHolidays(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('create', Shift::class);
        }

        $data = $request->validate([
            'month' => 'required|date',
        ]);

        try {
            $month = Carbon::parse($data['month'])->startOfMonth();
        } catch (\Exception $e) {
            return response()->json(['message' => '無効な月です。'], 400);
        }

        $start = $month->copy()->startOfMonth();
        $end = $month->copy()->endOfMonth();

        $users = User::where('status', 'active')->orderBy('position')->orderBy('id')->get();

        $created = 0;
        $updated = 0;

        \DB::transaction(function () use ($users, $start, $end, &$created, &$updated) {
            // iterate days of month
            $period = new \DatePeriod(new \DateTime($start->toDateString()), new \DateInterval('P1D'), (new \DateTime($end->toDateString()))->modify('+1 day'));
            // Prebuild list of dates grouped by weekday for efficiency
            $datesByWeekday = [];
            foreach ($period as $dt) {
                $ymd = $dt->format('Y-m-d');
                $wk = (int) $dt->format('w'); // 0 (Sun) - 6 (Sat)
                $datesByWeekday[$wk][] = $ymd;
            }

            foreach ($users as $u) {
                $prefsRaw = $u->preferred_week_days ?? [];

                // normalize to array: if stored as JSON string, decode it
                if (!is_array($prefsRaw) && is_string($prefsRaw)) {
                    $decoded = json_decode($prefsRaw, true);
                    if (is_array($decoded)) {
                        $prefs = $decoded;
                    } else {
                        // fallback: treat single string as one element
                        $prefs = [$prefsRaw];
                    }
                } elseif (is_array($prefsRaw)) {
                    $prefs = $prefsRaw;
                } else {
                    $prefs = (array) $prefsRaw;
                }

                if (empty($prefs)) continue;

                foreach ($prefs as $wk) {
                    $wkInt = null;
                    if (is_numeric($wk)) {
                        $wkInt = (int) $wk;
                    } else {
                        $s = strtolower(trim((string) $wk));
                        // accept English short/full names and Japanese short names
                        $map = [
                            'sun' => 0,
                            'sunday' => 0,
                            '日' => 0,
                            'mon' => 1,
                            'monday' => 1,
                            '月' => 1,
                            'tue' => 2,
                            'tues' => 2,
                            'tuesday' => 2,
                            '火' => 2,
                            'wed' => 3,
                            'wednesday' => 3,
                            '水' => 3,
                            'thu' => 4,
                            'thurs' => 4,
                            'thursday' => 4,
                            '木' => 4,
                            'fri' => 5,
                            'friday' => 5,
                            '金' => 5,
                            'sat' => 6,
                            'saturday' => 6,
                            '土' => 6,
                        ];
                        if (isset($map[$s])) $wkInt = $map[$s];
                    }

                    if ($wkInt === null) continue;

                    $dates = $datesByWeekday[$wkInt] ?? [];
                    foreach ($dates as $d) {
                        // create or update shift to 'leave'
                        $shift = Shift::where('user_id', $u->id)->whereRaw('date(date) = ?', [$d])->first();
                        if ($shift) {
                            if ($shift->shift_type !== 'leave') {
                                // delete existing details and set to leave
                                ShiftDetail::where('user_id', $u->id)->whereRaw('date(date) = ?', [$d])->delete();
                                $shift->update(['shift_type' => 'leave']);
                                $updated++;
                            }
                        } else {
                            Shift::create(['user_id' => $u->id, 'date' => $d, 'shift_type' => 'leave']);
                            // remove any details just in case
                            ShiftDetail::where('user_id', $u->id)->whereRaw('date(date) = ?', [$d])->delete();
                            $created++;
                        }
                    }
                }
            }
        });

        return response()->json(['message' => "完了しました。作成: {$created} 件、更新: {$updated} 件"], 200);
    }

    /**
     * Auto-register shifts for users based on their employment period.
     * For each active user with employment_start_date and employment_end_date,
     * create 'day' shifts for dates within their employment period and the specified month,
     * respecting their preferred weekly holidays and default work times.
     * Does not overwrite existing shifts.
     */
    public function autoRegisterEmploymentPeriod(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('create', Shift::class);
        }

        $data = $request->validate([
            'month' => 'required|date',
        ]);

        try {
            $month = Carbon::parse($data['month'])->startOfMonth();
        } catch (\Exception $e) {
            return response()->json(['message' => '無効な月です。'], 400);
        }

        $monthStart = $month->copy()->startOfMonth();
        $monthEnd = $month->copy()->endOfMonth();

        $users = User::where('status', 'active')
            ->whereNotNull('employment_start_date')
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        // 祝日一覧を取得
        $holidays = Holiday::whereBetween('date', [$monthStart, $monthEnd])
            ->pluck('date')
            ->map(function ($d) {
                return Carbon::parse($d)->toDateString();
            })
            ->toArray();

        // デフォルトシフト設定を取得
        $defaultShifts = DefaultShift::all();

        $created = 0;
        $skipped = 0;

        \DB::transaction(function () use ($users, $monthStart, $monthEnd, $holidays, $defaultShifts, &$created, &$skipped) {
            foreach ($users as $u) {
                $empStart = $u->employment_start_date ? Carbon::parse($u->employment_start_date) : null;
                $empEnd = $u->employment_end_date ? Carbon::parse($u->employment_end_date) : null;

                if (!$empStart) {
                    continue;
                }

                // Determine the date range: intersection of employment period and the month
                $rangeStart = max($empStart, $monthStart);
                $rangeEnd = $empEnd && $empEnd->lt($monthEnd) ? $empEnd : $monthEnd;

                if ($rangeStart->gt($rangeEnd)) {
                    continue; // no overlap
                }

                // Parse preferred weekly holidays
                $prefsRaw = $u->preferred_week_days ?? [];
                if (!is_array($prefsRaw) && is_string($prefsRaw)) {
                    $decoded = json_decode($prefsRaw, true);
                    $prefs = is_array($decoded) ? $decoded : [$prefsRaw];
                } elseif (is_array($prefsRaw)) {
                    $prefs = $prefsRaw;
                } else {
                    $prefs = (array) $prefsRaw;
                }

                // Normalize preferred weekdays to integers (0-6)
                $preferredHolidayWeekdays = [];
                foreach ($prefs as $wk) {
                    $wkInt = null;
                    if (is_numeric($wk)) {
                        $wkInt = (int) $wk;
                    } else {
                        $s = strtolower(trim((string) $wk));
                        $map = [
                            'sun' => 0,
                            'sunday' => 0,
                            '日' => 0,
                            'mon' => 1,
                            'monday' => 1,
                            '月' => 1,
                            'tue' => 2,
                            'tues' => 2,
                            'tuesday' => 2,
                            '火' => 2,
                            'wed' => 3,
                            'wednesday' => 3,
                            '水' => 3,
                            'thu' => 4,
                            'thurs' => 4,
                            'thursday' => 4,
                            '木' => 4,
                            'fri' => 5,
                            'friday' => 5,
                            '金' => 5,
                            'sat' => 6,
                            'saturday' => 6,
                            '土' => 6,
                        ];
                        if (isset($map[$s])) $wkInt = $map[$s];
                    }
                    if ($wkInt !== null) {
                        $preferredHolidayWeekdays[] = $wkInt;
                    }
                }

                // Iterate over each day in the range
                $period = new \DatePeriod(
                    new \DateTime($rangeStart->toDateString()),
                    new \DateInterval('P1D'),
                    (new \DateTime($rangeEnd->toDateString()))->modify('+1 day')
                );

                foreach ($period as $dt) {
                    $ymd = $dt->format('Y-m-d');
                    $wk = (int) $dt->format('w'); // 0 (Sun) - 6 (Sat)

                    // Skip if this weekday is a preferred holiday
                    if (in_array($wk, $preferredHolidayWeekdays, true)) {
                        continue;
                    }

                    // Check if a shift already exists for this user and date
                    $existingShift = Shift::where('user_id', $u->id)
                        ->whereRaw('date(date) = ?', [$ymd])
                        ->first();

                    if ($existingShift) {
                        $skipped++;
                        continue; // do not overwrite existing shifts
                    }

                    // Create a 'day' shift
                    $shift = Shift::create([
                        'user_id' => $u->id,
                        'date' => $ymd,
                        'shift_type' => 'day',
                    ]);

                    // デフォルトシフト時間の決定
                    $startTime = null;
                    $endTime = null;

                    // ユーザーのdefault_start_time/default_end_timeが0:00~0:00の場合はデフォルトシフトを優先
                    $useDefaultShift = false;
                    if (
                        (!$u->default_start_time || $u->default_start_time === '00:00' || $u->default_start_time === '00:00:00') &&
                        (!$u->default_end_time || $u->default_end_time === '00:00' || $u->default_end_time === '00:00:00')
                    ) {
                        $useDefaultShift = true;
                    }

                    if ($useDefaultShift) {
                        // デフォルトシフトから該当する時間を取得
                        $isHoliday = in_array($ymd, $holidays, true);
                        $patternType = $isHoliday ? 'holiday' : 'weekday';

                        foreach ($defaultShifts as $ds) {
                            if (
                                (int)$ds->day_of_week === $wk &&
                                $ds->shift_type === 'day' &&
                                $ds->type === $patternType
                            ) {
                                $startTime = $ds->start_time ?? null;
                                $endTime = $ds->end_time ?? null;
                                break;
                            }
                        }

                        // デフォルトシフトが見つからない場合は標準時間を使用
                        if (!$startTime || !$endTime) {
                            $startTime = '09:00';
                            $endTime = '18:00';
                        }
                    } else {
                        // ユーザー個別の時間を使用
                        $startTime = $u->default_start_time ?? '09:00';
                        $endTime = $u->default_end_time ?? '18:00';
                    }

                    ShiftDetail::create([
                        'shift_id' => $shift->id,
                        'user_id' => $u->id,
                        'date' => $ymd,
                        'type' => 'work',
                        'status' => 'scheduled',
                        'start_time' => $ymd . ' ' . $startTime,
                        'end_time' => $ymd . ' ' . $endTime,
                    ]);

                    $created++;
                }
            }
        });

        return response()->json([
            'message' => "完了しました。作成: {$created} 件、スキップ: {$skipped} 件"
        ], 200);
    }
}
