<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ShiftDetail;
use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Illuminate\Support\Facades\Mail;
use App\Mail\TemporaryCredentialsMail;
use Illuminate\Validation\Rules;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class UserController extends Controller
{
    /**
     * ユーザー一覧を表示します。
     * クエリパラメータに基づいて並び替えを行います。
     */
    public function index(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('viewAny', User::class);
        }

        // 並び替えの対象となるカラムをホワイトリストで定義
        $sortableColumns = ['id', 'name', 'email', 'status', 'created_at'];
        $sort = in_array($request->query('sort', 'id'), $sortableColumns) ? $request->query('sort', 'id') : 'id';
        $direction = in_array($request->query('direction', 'asc'), ['asc', 'desc']) ? $request->query('direction', 'asc') : 'asc';

        $users = User::with('roles')
            ->orderBy($sort, $direction)
            ->simplePaginate(50) // ページネーションを追加
            ->withQueryString(); // クエリパラメータを維持

        return Inertia::render('users/index', [
            'users' => $users,
            'queryParams' => $request->query() ?: null, // 現在のクエリパラメータを渡す
        ]);
    }

    /**
     * ユーザー作成フォームを表示します。
     */
    public function create()
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('create', User::class);
        }
        // セッションにフラッシュされた credentials があれば props として渡す
        $credentials = session('credentials') ?: null;
        return Inertia::render('users/create', [
            'credentials' => $credentials,
        ]);
    }

    /**
     * 作成後に表示する認証情報ページ
     */
    public function credentials(User $user)
    {
        $credentials = null;
        if ($user->temporary_password && $user->temporary_password_expires_at && $user->temporary_password_expires_at->isFuture()) {
            try {
                $credentials = [
                    'name' => $user->name,
                    'email' => $user->email,
                    'temporary_password' => decrypt($user->temporary_password),
                ];
            } catch (\Throwable $e) {
                // ignore decryption errors
                $credentials = null;
            }
        }

        return Inertia::render('users/credentials', [
            'credentials' => $credentials,
            'user' => $user,
        ]);
    }

    /**
     * Send temporary credentials to user's email
     */
    public function sendCredentials(User $user)
    {
        // check temporary password exists and not expired
        if (! $user->temporary_password || ! $user->temporary_password_expires_at || ! $user->temporary_password_expires_at->isFuture()) {
            if (request()->wantsJson()) {
                return response()->json(['error' => '送信できる認証情報がありません。'], 400);
            }
            return Redirect::back()->with('error', '送信できる認証情報がありません。');
        }

        try {
            $temporary = decrypt($user->temporary_password);
        } catch (\Throwable $e) {
            if (request()->wantsJson()) {
                return response()->json(['error' => '認証情報の復号に失敗しました。'], 500);
            }
            return Redirect::back()->with('error', '認証情報の復号に失敗しました。');
        }

        // send mail
        try {
            Mail::to($user->email)->send(new \App\Mail\TemporaryCredentialsMail($user, $temporary));
        } catch (\Throwable $e) {
            if (request()->wantsJson()) {
                return response()->json(['error' => 'メール送信に失敗しました。'], 500);
            }
            return Redirect::back()->with('error', 'メール送信に失敗しました。');
        }

        if (request()->wantsJson()) {
            return response()->json(['message' => '認証情報をメールで送信しました。'], 200);
        }

        return Redirect::back()->with('success', '認証情報をメールで送信しました。');
    }

    /**
     * Send credentials by providing email in the POST body (no user id)
     */
    public function sendCredentialsByEmail(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->input('email'))->first();
        if (! $user) {
            return response()->json(['error' => 'ユーザーが見つかりません。'], 404);
        }

        // Delegate to sendCredentials to reuse logic
        return $this->sendCredentials($user);
    }

    /**
     * Regenerate a temporary password for the user and return it (JSON for AJAX)
     */
    public function regenerateTemporaryPassword(User $user)
    {
        // create new temporary password
        $temporaryPassword = Str::random(12);

        $user->temporary_password = encrypt($temporaryPassword);
        $user->temporary_password_expires_at = now()->addDay();
        $user->password = Hash::make($temporaryPassword);
        $user->must_change_password = true;
        $user->save();

        if (request()->wantsJson()) {
            return response()->json([
                'message' => '仮パスワードを再作成しました。',
                'temporary_password' => $temporaryPassword,
            ], 200);
        }

        return Redirect::back()->with('success', '仮パスワードを再作成しました。');
    }

    /**
     * ユーザー編集フォームを表示します。
     */
    public function edit(User $user)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('view', $user);
        }
        return Inertia::render('users/edit', [
            'user' => $user,
        ]);
    }

    /**
     * 新しいユーザーを作成し、保存します。
     */
    public function store(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('create', User::class);
        }
        $messages = [
            'name.required' => '名前は必須です。',
            'name.string' => '名前は文字列で指定してください。',
            'name.max' => '名前は:max文字以内で入力してください。',

            'email.required' => 'メールアドレスは必須です。',
            'email.email' => '有効なメールアドレスを入力してください。',
            'email.unique' => '指定されたメールアドレスは既に使用されています。',
            'email.max' => 'メールアドレスは:max文字以内で入力してください。',

            'status.required' => 'ステータスは必須です。',
            'status.in' => '無効なステータスが選択されました。',

            'phone_number.max' => '電話番号は:max文字以内で入力してください。',
            'line_name.max' => 'LINE名は:max文字以内で入力してください。',
            'memo.string' => 'メモは文字列で入力してください。',
            'gender.required' => '性別は必須です。',
            'gender.in' => '無効な性別が選択されました。',
            'has_car.required' => '車の有無は必須です。',
            'has_car.boolean' => '車の有無は真偽値で指定してください。',
        ];

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:' . User::class,
            'status' => 'required|in:active,retired,shared',
            'phone_number' => 'nullable|string|max:20',
            'line_name' => 'nullable|string|max:255',
            'memo' => 'nullable|string',
            'gender' => 'required|in:male,female,other',
            'has_car' => 'required|boolean',
        ], $messages);

        // 仮パスワードを生成
        $temporaryPassword = Str::random(12);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'status' => $request->status,
            'gender' => $request->gender,
            'has_car' => boolval($request->has_car),
            'phone_number' => $request->phone_number,
            'line_name' => $request->line_name,
            'memo' => $request->memo,
            'password' => Hash::make($temporaryPassword),
            'must_change_password' => true,
        ]);

        // 永続化用の一時パスワードは暗号化して保存（期限: 24時間）
        $user->temporary_password = encrypt($temporaryPassword);
        $user->temporary_password_expires_at = now()->addDay();
        $user->save();

        // TODO: 作成したユーザーに仮パスワードを通知するメール送信処理を実装
        // Mail::to($request->email)->send(new UserCreatedMail($temporaryPassword));

        // 作成完了後は Inertia レスポンスで認証情報ページを直接返す
        return Inertia::render('users/credentials', [
            'credentials' => [
                'name' => $user->name,
                'email' => $request->email,
                'temporary_password' => $temporaryPassword,
            ],
            'success' => 'ユーザーが作成されました。',
        ]);
    }

    /**
     * ユーザー情報を更新します。
     */
    public function update(Request $request, User $user)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('update', $user);
        }
        $messages = [
            'name.required' => '名前は必須です。',
            'name.string' => '名前は文字列で指定してください。',
            'name.max' => '名前は:max文字以内で入力してください。',

            'email.required' => 'メールアドレスは必須です。',
            'email.email' => '有効なメールアドレスを入力してください。',
            'email.unique' => '指定されたメールアドレスは既に使用されています。',
            'email.max' => 'メールアドレスは:max文字以内で入力してください。',

            'status.required' => 'ステータスは必須です。',
            'status.in' => '無効なステータスが選択されました。',

            'phone_number.max' => '電話番号は:max文字以内で入力してください。',
            'line_name.max' => 'LINE名は:max文字以内で入力してください。',
            'memo.string' => 'メモは文字列で入力してください。',
            'gender.required' => '性別は必須です。',
            'gender.in' => '無効な性別が選択されました。',
            'has_car.required' => '車の有無は必須です。',
            'has_car.boolean' => '車の有無は真偽値で指定してください。',
        ];

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:' . User::class . ',email,' . $user->id,
            'status' => 'required|in:active,retired,shared',
            'phone_number' => 'nullable|string|max:20',
            'line_name' => 'nullable|string|max:255',
            'memo' => 'nullable|string',
            'gender' => 'required|in:male,female,other',
            'has_car' => 'required|boolean',
        ], $messages);

        $user->update($request->only(['name', 'email', 'status', 'gender', 'has_car', 'phone_number', 'line_name', 'memo']));

        return Redirect::route('users.index')->with('success', 'ユーザー情報を更新しました。');
    }

    /**
     * ユーザーを削除します。
     */
    public function destroy(User $user)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('delete', $user);
        }
        $user->delete();

        return Redirect::route('users.index')->with('success', 'ユーザーを削除しました。');
    }

    /**
     * ユーザー統計ページ（全ユーザーの月別出勤日数・出勤時間合計）を表示します。
     * 表示期間: 過去3か月 + 現在 + 未来2か月（合計6ヶ月）。
     * months は左が古い月、右が新しい月の昇順で返します。
     */
    public function stats(Request $request)
    {
        // Authorization: 管理者または shift.view 権限を持つユーザーのみ
        if (! (Auth::user()->hasRole('システム管理者') || Auth::user()->hasPermissionTo('shift.view'))) {
            $this->authorize('viewAny', User::class);
        }

        $months = [];
        $now = Carbon::now();
        // start: 3 months in the past (so sequence: -3, -2, -1, 0, +1, +2)
        $start = $now->copy()->subMonths(3);
        for ($i = 0; $i < 6; $i++) {
            $m = $start->copy()->addMonths($i);
            $months[] = $m->format('Y-m'); // e.g. 2025-05,2025-06,...,2025-10
        }

        $users = User::orderBy('id', 'asc')->get();

        // Compute earliest/latest range for queries (cover full months)
        // months[0] is the earliest (left), end($months) is the latest (right)
        $earliest = Carbon::createFromFormat('Y-m', $months[0])->startOfMonth();
        $latest = Carbon::createFromFormat('Y-m', end($months))->endOfMonth();

        // Fetch shifts (one row per date/user) for counting 出勤日数 where shift_type is day/night
        $shifts = Shift::whereBetween('date', [$earliest->toDateString(), $latest->toDateString()])
            ->whereIn('shift_type', ['day', 'night'])
            ->get();

        // Fetch shift details for the range to sum worked minutes
        $shiftDetails = ShiftDetail::whereBetween('start_time', [$earliest->toDateTimeString(), $latest->toDateTimeString()])->get();

        // Debug log: range and counts
        Log::info('UserStats: range and fetch counts', [
            'earliest' => $earliest->toDateTimeString(),
            'latest' => $latest->toDateTimeString(),
            'shifts_count' => $shifts->count(),
            'shift_details_count' => $shiftDetails->count(),
        ]);

        // More detailed diagnostics for shift_details: by type/status and sample rows
        $detailSummary = [
            'total' => $shiftDetails->count(),
            'with_times_count' => 0,
            'by_type_status' => [],
        ];
        $samples = [];
        $sampleLimit = 10;
        foreach ($shiftDetails as $sd) {
            $type = isset($sd->type) ? (string)$sd->type : '(null)';
            $status = isset($sd->status) ? (string)$sd->status : '(null)';
            // parse minutes if possible
            $minutes = 0;
            try {
                if ($sd->start_time && $sd->end_time) {
                    $st = Carbon::parse($sd->start_time);
                    $et = Carbon::parse($sd->end_time);
                    // use absolute diff to avoid negative results from timezone/ordering issues
                    $minutes = max(0, (int) $et->diffInMinutes($st, true));
                    if ($minutes > 0) $detailSummary['with_times_count']++;
                }
            } catch (\Throwable $e) {
                // ignore parse
            }

            if (!isset($detailSummary['by_type_status'][$type])) $detailSummary['by_type_status'][$type] = [];
            if (!isset($detailSummary['by_type_status'][$type][$status])) {
                $detailSummary['by_type_status'][$type][$status] = ['count' => 0, 'minutes' => 0];
            }
            $detailSummary['by_type_status'][$type][$status]['count'] += 1;
            $detailSummary['by_type_status'][$type][$status]['minutes'] += $minutes;

            if (count($samples) < $sampleLimit) {
                $samples[] = [
                    'id' => $sd->id ?? null,
                    'user_id' => $sd->user_id ?? null,
                    'date' => $sd->date ?? null,
                    'start_time' => $sd->start_time ?? null,
                    'end_time' => $sd->end_time ?? null,
                    'type' => $type,
                    'status' => $status,
                    'minutes' => $minutes,
                ];
            }
        }
        // Detailed per-sample parse diagnostics (first 20)
        $perSampleDebug = [];
        $i = 0;
        foreach ($shiftDetails as $sd) {
            if ($i++ >= 20) break;
            $rawStart = $sd->start_time ?? null;
            $rawEnd = $sd->end_time ?? null;
            $parsedStart = null;
            $parsedEnd = null;
            $diff = null;
            $error = null;
            try {
                if ($rawStart) $parsedStart = Carbon::parse($rawStart)->toDateTimeString();
                if ($rawEnd) $parsedEnd = Carbon::parse($rawEnd)->toDateTimeString();
                if ($parsedStart && $parsedEnd) {
                    // explicit absolute diff
                    $diff = (int) Carbon::parse($parsedEnd)->diffInMinutes(Carbon::parse($parsedStart), true);
                }
            } catch (\Throwable $e) {
                $error = (string)$e->getMessage();
            }
            $perSampleDebug[] = [
                'id' => $sd->id ?? null,
                'rawStart' => $rawStart,
                'rawEnd' => $rawEnd,
                'parsedStart' => $parsedStart,
                'parsedEnd' => $parsedEnd,
                'diff' => $diff,
                'error' => $error,
            ];
        }
        Log::info('UserStats: per-sample parse debug', ['samples' => $perSampleDebug]);
        Log::info('UserStats: shift_details summary', [
            'summary' => $detailSummary,
            'samples' => $samples,
        ]);

        // Build map: userId -> month(YYYY-MM) -> {days: number, minutes: number}
        $stats = [];
        foreach ($users as $u) {
            $stats[$u->id] = [];
            foreach ($months as $m) {
                // days: 出勤日数（shifts の行数）
                // work_minutes: actual の work 分数合計
                // break_minutes: actual の break 分数合計
                // scheduled_work / scheduled_break: 予定の合計（actual がない場合のフォールバック）
                // minutes: 稼働時間 = max(0, actual_work - actual_break) または actual が無ければ scheduled を使用
                $stats[$u->id][$m] = [
                    'days' => 0,
                    'minutes' => 0,
                    'work_minutes' => 0,
                    'break_minutes' => 0,
                    'scheduled_work_minutes' => 0,
                    'scheduled_break_minutes' => 0,
                    'absent_count' => 0,
                ];
            }
        }

        // Count days from shifts rows
        foreach ($shifts as $s) {
            try {
                $uid = $s->user_id;
                if (!isset($stats[$uid])) continue;
                $date = $s->date ? Carbon::parse($s->date) : null;
                if (!$date) continue;
                $monthKey = $date->format('Y-m');
                if (!isset($stats[$uid][$monthKey])) continue;
                // each shift row counts as one 出勤日
                $stats[$uid][$monthKey]['days'] += 1;
            } catch (\Throwable $e) {
                // ignore parsing errors
            }
        }

        // Sum work/break minutes from shift details according to the requested rules
        foreach ($shiftDetails as $sd) {
            try {
                $uid = $sd->user_id;
                if (!isset($stats[$uid])) continue;
                $start = $sd->start_time ? Carbon::parse($sd->start_time) : null;
                $end = $sd->end_time ? Carbon::parse($sd->end_time) : null;
                if (!$start || !$end) continue;
                $monthKey = $start->format('Y-m');
                if (!isset($stats[$uid][$monthKey])) continue;

                // ensure absolute positive minutes (avoid negative diffs due to ordering/timezone)
                $minutes = max(0, (int) $end->diffInMinutes($start, true));

                $type = isset($sd->type) ? (string)$sd->type : '';
                $status = isset($sd->status) ? (string)$sd->status : '';

                if ($status === 'actual') {
                    if ($type === 'work') {
                        $stats[$uid][$monthKey]['work_minutes'] += $minutes;
                    } elseif ($type === 'break') {
                        $stats[$uid][$monthKey]['break_minutes'] += $minutes;
                    }
                } elseif ($status === 'scheduled') {
                    // only count scheduled minutes when status explicitly scheduled
                    if ($type === 'work') {
                        $stats[$uid][$monthKey]['scheduled_work_minutes'] += $minutes;
                    } elseif ($type === 'break') {
                        $stats[$uid][$monthKey]['scheduled_break_minutes'] += $minutes;
                    }
                } elseif ($status === 'absent') {
                    // count absent occurrences for work-type entries
                    if ($type === 'work') {
                        $stats[$uid][$monthKey]['absent_count'] += 1;
                    }
                }
            } catch (\Throwable $e) {
                // ignore parsing errors
            }
        }

        // Compute final 稼働時間 = 実績の work_minutes - break_minutes （status === 'actual' のみ）
        foreach ($users as $u) {
            foreach ($months as $m) {
                if (isset($stats[$u->id][$m])) {
                    $work = $stats[$u->id][$m]['work_minutes'] ?? 0; // actual work only
                    $br = $stats[$u->id][$m]['break_minutes'] ?? 0; // actual break only
                    $stats[$u->id][$m]['minutes'] = max(0, $work - $br);
                }
            }
        }

        // Debug log: aggregate totals across all users/months for quick inspection
        $totals = [
            'actual_work' => 0,
            'actual_break' => 0,
            'scheduled_work' => 0,
            'scheduled_break' => 0,
            'final_working_minutes' => 0,
        ];
        foreach ($users as $u) {
            foreach ($months as $m) {
                $entry = $stats[$u->id][$m] ?? null;
                if (!$entry) continue;
                $totals['actual_work'] += $entry['work_minutes'] ?? 0;
                $totals['actual_break'] += $entry['break_minutes'] ?? 0;
                $totals['scheduled_work'] += $entry['scheduled_work_minutes'] ?? 0;
                $totals['scheduled_break'] += $entry['scheduled_break_minutes'] ?? 0;
                $totals['final_working_minutes'] += $entry['minutes'] ?? 0;
            }
        }
        Log::info('UserStats: aggregate totals', $totals);

        return Inertia::render('shifts/user-stats', [
            'users' => $users,
            'months' => $months,
            'stats' => $stats,
        ]);
    }
}
