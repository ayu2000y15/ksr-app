<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ShiftDetail;
use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
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

        $query = User::with(['roles', 'rentals' => function ($query) {
            $query->with(['rentalUser', 'returnUser', 'rentalItem'])->orderBy('rental_date', 'desc');
        }]);
        if ($sort === 'id') {
            // prefer explicit position ordering, fallback to id
            $query = $query->orderBy('position', $direction)->orderBy('id', $direction);
        } else {
            $query = $query->orderBy($sort, $direction);
        }

        $users = $query->simplePaginate(50)->withQueryString(); // ページネーションを追加 and keep query params

        return Inertia::render('users/index', [
            'users' => $users,
            'queryParams' => $request->query() ?: null, // 現在のクエリパラメータを渡す
        ]);
    }

    /**
     * JSON API: ページネーションされたユーザー一覧（無限スクロール用）
     */
    public function apiIndex(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('viewAny', User::class);
        }

        $sortableColumns = ['id', 'name', 'email', 'status', 'created_at'];
        $sort = in_array($request->query('sort', 'id'), $sortableColumns) ? $request->query('sort', 'id') : 'id';
        $direction = in_array($request->query('direction', 'asc'), ['asc', 'desc']) ? $request->query('direction', 'asc') : 'asc';

        $query = User::with(['roles', 'rentals' => function ($query) {
            $query->with(['rentalUser', 'returnUser', 'rentalItem'])->orderBy('rental_date', 'desc');
        }]);
        if ($sort === 'id') {
            $query = $query->orderBy('position', $direction)->orderBy('id', $direction);
        } else {
            $query = $query->orderBy($sort, $direction);
        }

        $users = $query->simplePaginate(50);

        // Return minimal JSON compatible shape used by frontend
        return response()->json([
            'data' => $users->items(),
            'next_page_url' => $users->nextPageUrl(),
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

        // 貸出物マスタを取得（有効なもののみ、表示順でソート）
        $rentalItems = \App\Models\RentalItem::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        // 現在の貸出中のアイテムを取得（返却日がnullのもの）
        $currentRentals = $user->rentals()
            ->whereNull('return_date')
            ->with('rentalItem')
            ->get();

        return Inertia::render('users/edit', [
            'user' => $user,
            'rentalItems' => $rentalItems,
            'currentRentals' => $currentRentals,
        ]);
    }

    /**
     * ユーザー詳細ページ（Inertia）を表示します。
     */
    public function show(Request $request, User $user)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('view', $user);
        }

        // Build properties array similar to existing API endpoint
        $properties = [];
        $allProps = \App\Models\Property::with(['roomOccupancies', 'realEstateAgent'])->get();
        foreach ($allProps as $p) {
            $matched = [];
            foreach ($p->roomOccupancies as $occ) {
                $uids = [];
                if (is_array($occ->user_ids)) {
                    $uids = $occ->user_ids;
                } elseif ($occ->user_ids) {
                    try {
                        $uids = json_decode($occ->user_ids, true) ?: [];
                    } catch (\Throwable $e) {
                        $uids = [];
                    }
                }
                if (!empty($uids) && in_array(intval($user->id), array_map('intval', $uids), true)) {
                    $matched[] = $occ;
                }
            }
            if (count($matched) > 0) {
                // Build occupancy arrays with cohabitants (other users in the same occupancy)
                $occupancyRows = [];
                foreach ($matched as $occ) {
                    $uids = [];
                    if (is_array($occ->user_ids)) {
                        $uids = $occ->user_ids;
                    } elseif ($occ->user_ids) {
                        try {
                            $uids = json_decode($occ->user_ids, true) ?: [];
                        } catch (\Throwable $e) {
                            $uids = [];
                        }
                    }
                    // Find cohabitants excluding the current user
                    $cohabitantUsers = [];
                    if (!empty($uids)) {
                        $ids = array_map('intval', $uids);
                        // fetch users except the current user
                        $cohabitants = \App\Models\User::whereIn('id', $ids)->where('id', '!=', intval($user->id))->get(['id', 'name', 'has_car']);
                        foreach ($cohabitants as $c) {
                            $cohabitantUsers[] = ['id' => $c->id, 'name' => $c->name, 'has_car' => (bool)($c->has_car ?? false)];
                        }
                    }

                    $occupancyRows[] = [
                        'id' => $occ->id,
                        'move_in_date' => $occ->move_in_date ?? null,
                        'move_out_date' => $occ->move_out_date ?? null,
                        'checkout_user_id' => $occ->checkout_user_id ?? null,
                        'user_ids' => $uids,
                        'cohabitants' => $cohabitantUsers,
                    ];
                }

                $prop = [
                    'property' => [
                        'id' => $p->id,
                        'name' => $p->name,
                        'postcode' => $p->postal_code ?? null,
                        'address' => $p->address ?? null,
                        'has_parking' => $p->has_parking ?? false,
                    ],
                    'occupancies' => $occupancyRows,
                ];
                if ($p->real_estate_agent_id) {
                    $agent = $p->realEstateAgent ? ['id' => $p->realEstateAgent->id, 'name' => $p->realEstateAgent->name] : null;
                    $prop['property']['real_estate_agent'] = $agent;
                }
                $properties[] = $prop;
            }
        }

        // カレンダーデータの取得（15日区切り対応）
        $monthParam = $request->query('month');
        if ($monthParam) {
            try {
                $monthDate = Carbon::parse($monthParam);
            } catch (\Throwable $e) {
                $monthDate = Carbon::today();
            }
        } else {
            // デフォルトは今日の日付が含まれる15日区切りの期間
            $today = Carbon::today();
            $todayDay = $today->day;

            // 1-15日の場合は前月、16-31日の場合は当月
            if ($todayDay <= 15) {
                $monthDate = $today->copy()->subMonth()->startOfMonth();
            } else {
                $monthDate = $today->copy()->startOfMonth();
            }
        }

        // 15日区切り: 当月16日～翌月15日
        // monthDate は YYYY-MM-01 形式で渡されるので、その月の16日から翌月15日まで
        $year = $monthDate->year;
        $month = $monthDate->month;

        $startDate = Carbon::create($year, $month, 16, 0, 0, 0);
        $endDate = Carbon::create($year, $month, 16, 0, 0, 0)->addMonth()->subDay(); // 翌月15日
        $today = Carbon::today();

        $calendar = [];

        // 統計用変数（ユーザー別統計と同じロジック）
        $totalWorkDays = 0;
        $actualWorkMinutes = 0;  // status='actual' の work のみ
        $actualBreakMinutes = 0; // status='actual' の break のみ

        // ShiftとShiftDetailを取得
        // 注意: start_time でフィルタすると日付またぎに対応できるため date を使用
        $shifts = Shift::where('user_id', $user->id)
            ->whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->whereIn('shift_type', ['day', 'night']) // leave は除外
            ->orderBy('date', 'asc')
            ->get();

        $shiftDetails = ShiftDetail::where('user_id', $user->id)
            ->whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->orderBy('date', 'asc')
            ->orderBy('start_time', 'asc')
            ->get();

        // 送迎情報を取得（ユーザー別統計と同じ条件: created_by でフィルタ）
        $transportRequests = \App\Models\TransportRequest::where('created_by', $user->id)
            ->whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->orderBy('date', 'asc')
            ->get();

        // 日付ごとにデータをグループ化
        $shiftsByDate = $shifts->groupBy('date');
        $detailsByDate = $shiftDetails->groupBy('date');

        // 送迎情報を日付で正規化してグループ化（date カラムが様々な形式の可能性があるため）
        $transportsByDate = $transportRequests->groupBy(function ($tr) {
            try {
                // date が Y/m/d や Y-m-d などの形式に対応
                $parsed = Carbon::parse($tr->date);
                return $parsed->format('Y-m-d');
            } catch (\Throwable $e) {
                return $tr->date; // パースできない場合はそのまま
            }
        });

        // 期間内の全日付をループ
        $currentDate = $startDate->copy();
        while ($currentDate->lte($endDate)) {
            $dateStr = $currentDate->format('Y-m-d');
            $isPast = $currentDate->lt($today);
            $isToday = $currentDate->eq($today);

            $shift = $shiftsByDate->get($dateStr)?->first();
            $details = $detailsByDate->get($dateStr) ?? collect();

            // 送迎情報を確認
            $transports = $transportsByDate->get($dateStr) ?? collect();
            $hasTransportTo = false;
            $hasTransportFrom = false;
            foreach ($transports as $tr) {
                $direction = isset($tr->direction) ? (string)$tr->direction : 'to';
                if ($direction === 'to') {
                    $hasTransportTo = true;
                } else {
                    $hasTransportFrom = true;
                }
            }

            $dayData = [
                'date' => $dateStr,
                'is_past' => $isPast,
                'is_today' => $isToday,
                'shift_type' => $shift?->shift_type ?? null,
                'work_times' => [],
                'break_times' => [],
                'is_absent' => false,
                'has_transport_to' => $hasTransportTo,
                'has_transport_from' => $hasTransportFrom,
            ];

            foreach ($details as $detail) {
                $type = isset($detail->type) ? (string)$detail->type : '';
                $status = isset($detail->status) ? (string)$detail->status : '';

                if ($type === 'work') {
                    // 過去・今日は actual のみ表示、未来は scheduled も表示
                    if ($isPast || $isToday) {
                        // actual のみを表示
                        if ($status === 'actual') {
                            $workData = [
                                'start_time' => $detail->start_time,
                                'end_time' => $detail->end_time,
                                'status' => $detail->status,
                            ];
                            $dayData['work_times'][] = $workData;

                            // 統計計算: actual の work 時間
                            if ($detail->start_time && $detail->end_time) {
                                try {
                                    $start = Carbon::parse($detail->start_time);
                                    $end = Carbon::parse($detail->end_time);
                                    $minutes = max(0, (int) $end->diffInMinutes($start, true));
                                    $actualWorkMinutes += $minutes;
                                } catch (\Throwable $e) {
                                    // ignore
                                }
                            }
                        } else if ($status === 'absent') {
                            $dayData['is_absent'] = true;
                            $workData = [
                                'start_time' => $detail->start_time,
                                'end_time' => $detail->end_time,
                                'status' => $detail->status,
                            ];
                            $dayData['work_times'][] = $workData;
                        }
                    } else {
                        // 未来: scheduled を表示
                        if ($status === 'scheduled') {
                            $workData = [
                                'start_time' => $detail->start_time,
                                'end_time' => $detail->end_time,
                                'status' => $detail->status,
                            ];
                            $dayData['work_times'][] = $workData;
                        }
                    }
                } elseif ($type === 'break') {
                    // 過去・今日は actual のみ表示、未来は scheduled も表示
                    if ($isPast || $isToday) {
                        // actual のみを表示
                        if ($status === 'actual') {
                            $breakData = [
                                'start_time' => $detail->start_time,
                                'end_time' => $detail->end_time,
                                'status' => $detail->status,
                            ];
                            $dayData['break_times'][] = $breakData;

                            // 統計計算: actual の break 時間
                            if ($detail->start_time && $detail->end_time) {
                                try {
                                    $start = Carbon::parse($detail->start_time);
                                    $end = Carbon::parse($detail->end_time);
                                    $minutes = max(0, (int) $end->diffInMinutes($start, true));
                                    $actualBreakMinutes += $minutes;
                                } catch (\Throwable $e) {
                                    // ignore
                                }
                            }
                        }
                    } else {
                        // 未来: scheduled を表示
                        if ($status === 'scheduled') {
                            $breakData = [
                                'start_time' => $detail->start_time,
                                'end_time' => $detail->end_time,
                                'status' => $detail->status,
                            ];
                            $dayData['break_times'][] = $breakData;
                        }
                    }
                }
            }

            $calendar[] = $dayData;
            $currentDate->addDay();
        }

        // 出勤日数を計算（ユーザー別統計と同じロジック）
        $totalWorkDays = $shifts->count();

        // 送迎回数を計算
        $transportToCount = 0;
        $transportFromCount = 0;
        foreach ($transportRequests as $tr) {
            $direction = isset($tr->direction) ? (string)$tr->direction : 'to';
            if ($direction === 'to') {
                $transportToCount++;
            } else {
                $transportFromCount++;
            }
        }

        // 統計情報を計算（ユーザー別統計と同じ: actual の work - break）
        $totalRestraintHours = floor($actualWorkMinutes / 60);
        $totalRestraintMinutesRemainder = $actualWorkMinutes % 60;
        $totalBreakHours = floor($actualBreakMinutes / 60);
        $totalBreakMinutesRemainder = $actualBreakMinutes % 60;

        // 総勤務時間 = actual work - actual break
        $netWorkMinutes = max(0, $actualWorkMinutes - $actualBreakMinutes);
        $netWorkHours = floor($netWorkMinutes / 60);
        $netWorkMinutesRemainder = $netWorkMinutes % 60;

        $stats = [
            'work_days' => $totalWorkDays,
            'total_restraint_time' => sprintf('%d時間%02d分', $totalRestraintHours, $totalRestraintMinutesRemainder),
            'total_break_time' => sprintf('%d時間%02d分', $totalBreakHours, $totalBreakMinutesRemainder),
            'total_work_time' => sprintf('%d時間%02d分', $netWorkHours, $netWorkMinutesRemainder),
            'transport_to_count' => $transportToCount,
            'transport_from_count' => $transportFromCount,
        ];

        return Inertia::render('users/show', [
            'user' => $user,
            'properties' => $properties,
            'calendar' => $calendar,
            'month' => $startDate->format('Y-m-d'),
            'stats' => $stats,
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
            'furigana' => 'nullable|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:' . User::class,
            'status' => 'required|in:active,retired,shared',
            'phone_number' => 'nullable|string|max:20',
            'line_name' => 'nullable|string|max:255',
            'memo' => 'nullable|string',
            'gender' => 'required|in:male,female,other',
            'has_car' => 'required|boolean',
            // new optional employment fields
            'employment_condition' => 'nullable|in:dormitory,commute',
            'commute_method' => 'nullable|string|max:255',
            'default_start_time' => 'nullable|date_format:H:i',
            'default_end_time' => 'nullable|date_format:H:i',
            'preferred_week_days' => 'nullable|array',
            'preferred_week_days.*' => 'in:Mon,Tue,Wed,Thu,Fri,Sat,Sun',
            'preferred_week_days_count' => 'nullable|integer|min:0|max:7',
            'employment_start_date' => 'nullable|date',
            'employment_end_date' => 'nullable|date|after_or_equal:employment_start_date',
            'employment_notes' => 'nullable|string',
        ], $messages);

        // 仮パスワードを生成
        $temporaryPassword = Str::random(12);

        $user = User::create([
            'name' => $request->name,
            'furigana' => $request->furigana,
            'email' => $request->email,
            'status' => $request->status,
            'gender' => $request->gender,
            'has_car' => boolval($request->has_car),
            'phone_number' => $request->phone_number,
            'line_name' => $request->line_name,
            'memo' => $request->memo,
            // optional employment fields
            'employment_condition' => $request->employment_condition,
            'commute_method' => $request->commute_method,
            'default_start_time' => $request->default_start_time,
            'default_end_time' => $request->default_end_time,
            'preferred_week_days' => $request->preferred_week_days ? json_encode($request->preferred_week_days) : null,
            'preferred_week_days_count' => $request->preferred_week_days_count ? intval($request->preferred_week_days_count) : null,
            'employment_start_date' => $request->employment_start_date,
            'employment_end_date' => $request->employment_end_date,
            'employment_notes' => $request->employment_notes,
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
            'profile_image' => 'nullable|image|max:2048',
        ], $messages);

        $user->fill($request->only([
            'name',
            'furigana',
            'email',
            'status',
            'gender',
            'has_car',
            'phone_number',
            'line_name',
            'memo',
            'employment_condition',
            'commute_method',
            'default_start_time',
            'default_end_time',
            'preferred_week_days',
            'preferred_week_days_count',
            'employment_start_date',
            'employment_end_date',
            'employment_notes'
        ]));

        // handle profile image removal or upload
        // client may send a boolean 'remove_profile_image' to clear existing image
        if ($request->has('remove_profile_image') && $request->input('remove_profile_image')) {
            try {
                if ($user->profile_image) {
                    // delete from storage if exists
                    try {
                        Storage::disk('public')->delete($user->profile_image);
                    } catch (\Throwable $e) {
                        // ignore storage delete errors
                    }
                    $user->profile_image = null;
                    $user->save();
                }
            } catch (\Throwable $e) {
                Log::error('Failed to remove profile image: ' . $e->getMessage());
            }
        } elseif ($request->hasFile('profile_image')) {
            try {
                $file = $request->file('profile_image');
                $path = $file->store('profile_images', 'public');
                $user->profile_image = $path;
                $user->save();
            } catch (\Throwable $e) {
                // log and continue; do not block other updates
                Log::error('Profile image upload failed: ' . $e->getMessage());
            }
        }

        // Ensure preferred_week_days and preferred_week_days_count stored correctly
        $dirty = false;
        if ($request->has('preferred_week_days')) {
            $user->preferred_week_days = $request->preferred_week_days ? json_encode($request->preferred_week_days) : null;
            $dirty = true;
        }
        if ($request->has('preferred_week_days_count')) {
            $user->preferred_week_days_count = $request->preferred_week_days_count !== null && $request->preferred_week_days_count !== '' ? intval($request->preferred_week_days_count) : null;
            $dirty = true;
        }
        if ($dirty) $user->save();

        // 貸出物の更新処理
        // 新規貸出
        if ($request->has('new_rental_items')) {
            $newRentalItemIds = $request->input('new_rental_items', []);

            foreach ($newRentalItemIds as $rentalItemId) {
                \App\Models\Rental::create([
                    'user_id' => $user->id,
                    'rental_item_id' => $rentalItemId,
                    'rental_date' => now()->toDateString(),
                    'rental_user_id' => Auth::id(),
                    'return_date' => null,
                    'return_user_id' => null,
                ]);
            }
        }

        // 返却処理
        if ($request->has('return_rental_items')) {
            $returnRentalItemIds = $request->input('return_rental_items', []);

            foreach ($returnRentalItemIds as $rentalItemId) {
                $rental = $user->rentals()
                    ->where('rental_item_id', $rentalItemId)
                    ->whereNull('return_date')
                    ->first();

                if ($rental) {
                    $rental->update([
                        'return_date' => now()->toDateString(),
                        'return_user_id' => Auth::id(),
                    ]);
                }
            }
        }

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
        // Authorization: 管理者、shift.view、または accounting.view 権限を持つユーザーのみ
        if (! (Auth::user()->hasRole('システム管理者') || Auth::user()->hasPermissionTo('shift.view') || Auth::user()->hasPermissionTo('accounting.view'))) {
            $this->authorize('viewAny', User::class);
        }

        $months = [];
        $now = Carbon::now();
        // 15日区切りの期間を6ヶ月分生成（4ヶ月前から1ヶ月後まで）
        $start = $now->copy()->subMonths(4);
        for ($i = 0; $i < 6; $i++) {
            $m = $start->copy()->addMonths($i);
            $months[] = $m->format('Y-m'); // e.g. 2025-05,2025-06,...,2025-10
        }

        $users = User::orderBy('position', 'asc')->get();

        // 15日区切りの期間範囲を計算
        // 最初の期間: months[0]の16日から開始
        // 最後の期間: end($months)の翌月15日まで
        $firstMonth = Carbon::createFromFormat('Y-m', $months[0]);
        $lastMonth = Carbon::createFromFormat('Y-m', end($months));

        $earliest = $firstMonth->copy()->day(16)->startOfDay();
        $latest = $lastMonth->copy()->addMonth()->day(15)->endOfDay();

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
                    'transport_requests_to_count' => 0,
                    'transport_requests_from_count' => 0,
                ];
            }
        }

        // Count days from shifts rows (15日区切り)
        foreach ($shifts as $s) {
            try {
                $uid = $s->user_id;
                if (!isset($stats[$uid])) continue;
                $date = $s->date ? Carbon::parse($s->date) : null;
                if (!$date) continue;

                // 15日区切りで月を決定: 16日～翌月15日
                $monthKey = $date->day <= 15
                    ? $date->copy()->subMonth()->format('Y-m')
                    : $date->format('Y-m');

                if (!isset($stats[$uid][$monthKey])) continue;
                // each shift row counts as one 出勤日
                $stats[$uid][$monthKey]['days'] += 1;
            } catch (\Throwable $e) {
                // ignore parsing errors
            }
        }

        // Sum work/break minutes from shift details according to the requested rules (15日区切り)
        foreach ($shiftDetails as $sd) {
            try {
                $uid = $sd->user_id;
                if (!isset($stats[$uid])) continue;
                $start = $sd->start_time ? Carbon::parse($sd->start_time) : null;
                $end = $sd->end_time ? Carbon::parse($sd->end_time) : null;
                if (!$start || !$end) continue;

                // 15日区切りで月を決定: 16日～翌月15日
                $monthKey = $start->day <= 15
                    ? $start->copy()->subMonth()->format('Y-m')
                    : $start->format('Y-m');

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

        // Count transport requests per creator per month within the same date range (15日区切り)
        try {
            $transportRequests = \App\Models\TransportRequest::whereBetween('date', [$earliest->toDateString(), $latest->toDateString()])->get();
            foreach ($transportRequests as $tr) {
                try {
                    $creatorId = $tr->created_by ?? null;
                    if (!$creatorId) continue;
                    $d = $tr->date ? Carbon::parse($tr->date) : null;
                    if (!$d) continue;

                    // 15日区切りで月を決定: 16日～翌月15日
                    $mk = $d->day <= 15
                        ? $d->copy()->subMonth()->format('Y-m')
                        : $d->format('Y-m');

                    if (isset($stats[$creatorId]) && isset($stats[$creatorId][$mk])) {
                        $dir = isset($tr->direction) ? (string)$tr->direction : 'to';
                        if ($dir === 'to') {
                            $stats[$creatorId][$mk]['transport_requests_to_count'] = ($stats[$creatorId][$mk]['transport_requests_to_count'] ?? 0) + 1;
                        } else {
                            $stats[$creatorId][$mk]['transport_requests_from_count'] = ($stats[$creatorId][$mk]['transport_requests_from_count'] ?? 0) + 1;
                        }
                    }
                } catch (\Throwable $e) {
                    // ignore per-row parse errors
                }
            }
        } catch (\Throwable $e) {
            // ignore transport request aggregation errors
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

    /**
     * 登録済みユーザー情報をCSVダウンロード
     */
    public function downloadSampleCsv()
    {
        try {
            if (Auth::user()->hasRole('システム管理者')) {
                // bypass
            } else {
                $this->authorize('viewAny', User::class);
            }
        } catch (\Exception $e) {
            // 権限エラーの場合は403を返す
            abort(403, 'この操作を実行する権限がありません。');
        }

        // 全ユーザーを取得
        $users = User::orderBy('id')->get();

        // CSVデータを生成
        $csvData = [];

        // BOM追加（Excel対応）
        $bom = chr(0xEF) . chr(0xBB) . chr(0xBF);

        // ヘッダー行
        $csvData[] = [
            '名前',
            'フリガナ',
            'メールアドレス',
            '電話番号',
            'LINE名',
            '性別',
            '車の有無',
            'ステータス',
            '採用条件',
            '通勤方法',
            '基本出勤開始時間',
            '基本出勤終了時間',
            '週休希望日数',
            '固定休希望',
            '勤務開始日',
            '勤務終了日',
            '勤務備考欄',
            'メモ',
        ];

        // ユーザーデータを追加
        foreach ($users as $user) {
            // 性別の変換
            $gender = '';
            if ($user->gender === 'male') {
                $gender = '男';
            } elseif ($user->gender === 'female') {
                $gender = '女';
            }

            // 車の有無
            $hasCar = $user->has_car ? '有' : '無';

            // ステータスの変換
            $status = '';
            if ($user->status === 'active') {
                $status = 'アクティブ';
            } elseif ($user->status === 'retired') {
                $status = '退職';
            } elseif ($user->status === 'shared') {
                $status = '共有';
            }

            // 採用条件の変換
            $employmentCondition = '';
            if ($user->employment_condition === 'dormitory') {
                $employmentCondition = '寮';
            } elseif ($user->employment_condition === 'commute') {
                $employmentCondition = '通勤';
            }

            // 固定休希望の変換
            $preferredWeekDays = '';
            if ($user->preferred_week_days) {
                $days = json_decode($user->preferred_week_days, true);
                if (is_array($days)) {
                    $preferredWeekDays = implode(',', $days);
                }
            }

            $csvData[] = [
                $user->name ?? '',
                $user->furigana ?? '',
                $user->email ?? '',
                $user->phone_number ?? '',
                $user->line_name ?? '',
                $gender,
                $hasCar,
                $status,
                $employmentCondition,
                $user->commute_method ?? '',
                $user->default_start_time ?? '',
                $user->default_end_time ?? '',
                $user->preferred_week_days_count ?? '',
                $preferredWeekDays,
                $user->employment_start_date ?? '',
                $user->employment_end_date ?? '',
                $user->employment_notes ?? '',
                $user->memo ?? '',
            ];
        }

        // CSV形式に変換
        $output = fopen('php://temp', 'r+');
        fwrite($output, $bom); // BOMを先頭に追加

        foreach ($csvData as $row) {
            fputcsv($output, $row);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        // レスポンスを返す
        $filename = 'users_' . date('Ymd_His') . '.csv';
        return response($csv, 200)
            ->header('Content-Type', 'text/csv; charset=UTF-8')
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    /**
     * CSVファイルから一括登録
     */
    public function importCsv(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // bypass
        } else {
            $this->authorize('create', User::class);
        }

        $request->validate([
            'csv_file' => 'required|file|mimes:csv,txt|max:2048',
        ]);

        try {
            $file = $request->file('csv_file');
            $path = $file->getRealPath();

            // BOM除去してファイルを読み込み
            $content = file_get_contents($path);
            $content = str_replace("\xEF\xBB\xBF", '', $content);

            // 一時ファイルに書き込み
            $tmpPath = tempnam(sys_get_temp_dir(), 'csv');
            file_put_contents($tmpPath, $content);

            $handle = fopen($tmpPath, 'r');

            // ヘッダー行をスキップ
            $header = fgetcsv($handle);

            $createdCount = 0;
            $updatedCount = 0;
            $errorCount = 0;
            $errors = [];
            $rowNumber = 1; // ヘッダー行

            // 日付/時刻の正規化ヘルパー
            $normalizeTime = function ($val) {
                if (!isset($val)) return null;
                $v = trim((string)$val);
                if ($v === '') return null;
                // 全角コロン対応
                $v = str_replace('：', ':', $v);
                // 単一の時間数字のみなら :00 を付与
                if (preg_match('/^\d{1,2}$/', $v)) {
                    $v = $v . ':00';
                }
                // strtotimeで解釈できるか確認
                $ts = strtotime($v);
                if ($ts === false) {
                    throw new \Exception("時刻の形式が正しくありません ({$val})");
                }
                return date('H:i:s', $ts);
            };

            $normalizeDate = function ($val) {
                if (!isset($val)) return null;
                $v = trim((string)$val);
                if ($v === '') return null;
                // スラッシュをハイフンへ
                $v = str_replace('/', '-', $v);
                $ts = strtotime($v);
                if ($ts === false) {
                    throw new \Exception("日付の形式が正しくありません ({$val})");
                }
                return date('Y-m-d', $ts);
            };

            while (($row = fgetcsv($handle)) !== false) {
                $rowNumber++;

                // 空行スキップ
                if (empty(array_filter($row))) {
                    continue;
                }

                try {
                    // 必須フィールドのバリデーション
                    if (empty($row[0])) {
                        $errors[] = "行 {$rowNumber}: 名前は必須です";
                        $errorCount++;
                        continue;
                    }
                    if (empty($row[2])) {
                        $errors[] = "行 {$rowNumber}: メールアドレスは必須です";
                        $errorCount++;
                        continue;
                    }

                    // メールアドレスの形式チェック
                    if (!filter_var($row[2], FILTER_VALIDATE_EMAIL)) {
                        $errors[] = "行 {$rowNumber}: メールアドレスの形式が正しくありません ({$row[2]})";
                        $errorCount++;
                        continue;
                    }

                    // 既存ユーザーチェック（メールアドレスと名前で判断）
                    $existingUser = User::where('email', $row[2])
                        ->orWhere(function ($query) use ($row) {
                            $query->where('name', $row[0])
                                ->where('furigana', $row[1] ?? null);
                        })
                        ->first();

                    // 性別の変換
                    $gender = null;
                    if (isset($row[5])) {
                        $genderValue = strtolower(trim($row[5]));
                        if (in_array($genderValue, ['male', '男', '男性'])) {
                            $gender = 'male';
                        } elseif (in_array($genderValue, ['female', '女', '女性'])) {
                            $gender = 'female';
                        }
                    }

                    // 車の有無の変換
                    $hasCar = false;
                    if (isset($row[6])) {
                        $carValue = strtolower(trim($row[6]));
                        $hasCar = in_array($carValue, ['1', 'true', 'yes', '有', 'あり']);
                    }

                    // ステータスの変換
                    $status = 'active';
                    if (isset($row[7])) {
                        $statusValue = strtolower(trim($row[7]));
                        if (in_array($statusValue, ['retired', '退職'])) {
                            $status = 'retired';
                        } elseif (in_array($statusValue, ['shared', '共有'])) {
                            $status = 'shared';
                        }
                    }

                    // 採用条件の変換
                    $employmentCondition = null;
                    if (isset($row[8]) && !empty(trim($row[8]))) {
                        $condValue = strtolower(trim($row[8]));
                        if (in_array($condValue, ['dormitory', '寮'])) {
                            $employmentCondition = 'dormitory';
                        } elseif (in_array($condValue, ['commute', '通勤'])) {
                            $employmentCondition = 'commute';
                        }
                    }

                    // 固定休希望の変換（カンマ区切り）
                    $preferredWeekDays = null;
                    if (isset($row[13]) && !empty(trim($row[13]))) {
                        $days = explode(',', $row[13]);
                        $preferredWeekDays = json_encode(array_map('trim', $days));
                    }

                    // ユーザーデータの準備
                    $userData = [
                        'name' => $row[0],
                        'furigana' => $row[1] ?? null,
                        'email' => $row[2],
                        'phone_number' => $row[3] ?? null,
                        'line_name' => $row[4] ?? null,
                        'gender' => $gender,
                        'has_car' => $hasCar,
                        'status' => $status,
                        'employment_condition' => $employmentCondition,
                        'commute_method' => $row[9] ?? null,
                        'default_start_time' => isset($row[10]) ? $normalizeTime($row[10]) : null,
                        'default_end_time' => isset($row[11]) ? $normalizeTime($row[11]) : null,
                        'preferred_week_days_count' => isset($row[12]) && is_numeric($row[12]) ? intval($row[12]) : null,
                        'preferred_week_days' => $preferredWeekDays,
                        'employment_start_date' => isset($row[14]) ? $normalizeDate($row[14]) : null,
                        'employment_end_date' => isset($row[15]) ? $normalizeDate($row[15]) : null,
                        'employment_notes' => $row[16] ?? null,
                        'memo' => $row[17] ?? null,
                    ];

                    if ($existingUser) {
                        // 既存ユーザーを更新
                        $existingUser->update($userData);
                        $updatedCount++;
                    } else {
                        // 新規ユーザーを作成（一番下に追加）
                        $temporaryPassword = Str::random(12);
                        $userData['password'] = Hash::make($temporaryPassword);
                        $userData['must_change_password'] = true;

                        // 現在の最大position値を取得して+1
                        $maxPosition = User::max('position') ?? 0;
                        $userData['position'] = $maxPosition + 1;

                        $user = User::create($userData);

                        // 永続化用の一時パスワードを暗号化して保存
                        $user->temporary_password = encrypt($temporaryPassword);
                        $user->temporary_password_expires_at = now()->addDay();
                        $user->save();

                        $createdCount++;
                    }
                } catch (\Exception $e) {
                    $errorMessage = $e->getMessage();
                    // SQLエラーの場合はより分かりやすく
                    if (strpos($errorMessage, 'Duplicate entry') !== false) {
                        $errorMessage = "重複するデータがあります";
                    } elseif (strpos($errorMessage, 'Data too long') !== false) {
                        $errorMessage = "データが長すぎます";
                    }
                    $errors[] = "行 {$rowNumber}: {$errorMessage}";
                    $errorCount++;
                }
            }

            fclose($handle);
            unlink($tmpPath);

            // 結果メッセージの作成
            $messages = [];
            if ($createdCount > 0) {
                $messages[] = "{$createdCount}件のユーザーを新規登録しました";
            }
            if ($updatedCount > 0) {
                $messages[] = "{$updatedCount}件のユーザーを更新しました";
            }
            if ($errorCount > 0) {
                $messages[] = "{$errorCount}件のエラーがありました";
            }

            $message = implode('。', $messages) . '。';

            if ($errorCount > 0) {
                return Redirect::route('users.index')
                    ->with('error', $message)
                    ->with('csv_errors', $errors);
            }

            return Redirect::route('users.index')->with('success', $message);
        } catch (\Exception $e) {
            return Redirect::route('users.index')->with('error', 'CSVの読み込みに失敗しました: ' . $e->getMessage());
        }
    }
}
