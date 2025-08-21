<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Illuminate\Support\Facades\Mail;
use App\Mail\TemporaryCredentialsMail;
use Illuminate\Validation\Rules;
use Illuminate\Support\Facades\Redirect;

class UserController extends Controller
{
    /**
     * ユーザー一覧を表示します。
     * クエリパラメータに基づいて並び替えを行います。
     */
    public function index(Request $request)
    {
        // 並び替えの対象となるカラムをホワイトリストで定義
        $sortableColumns = ['id', 'name', 'email', 'status', 'created_at'];
        $sort = in_array($request->query('sort', 'id'), $sortableColumns) ? $request->query('sort', 'id') : 'id';
        $direction = in_array($request->query('direction', 'asc'), ['asc', 'desc']) ? $request->query('direction', 'asc') : 'asc';

        $users = User::orderBy($sort, $direction)
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
            \Mail::to($user->email)->send(new \App\Mail\TemporaryCredentialsMail($user, $temporary));
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
        return Inertia::render('users/edit', [
            'user' => $user,
        ]);
    }

    /**
     * 新しいユーザーを作成し、保存します。
     */
    public function store(Request $request)
    {
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
        ];

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:' . User::class,
            'status' => 'required|in:active,retired,shared',
            'phone_number' => 'nullable|string|max:20',
            'line_name' => 'nullable|string|max:255',
            'memo' => 'nullable|string',
        ], $messages);

        // 仮パスワードを生成
        $temporaryPassword = Str::random(12);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'status' => $request->status,
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
        ];

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:' . User::class . ',email,' . $user->id,
            'status' => 'required|in:active,retired,shared',
            'phone_number' => 'nullable|string|max:20',
            'line_name' => 'nullable|string|max:255',
            'memo' => 'nullable|string',
        ], $messages);

        $user->update($request->only(['name', 'email', 'status', 'phone_number', 'line_name', 'memo']));

        return Redirect::route('users.index')->with('success', 'ユーザー情報を更新しました。');
    }

    /**
     * ユーザーを削除します。
     */
    public function destroy(User $user)
    {
        // ここで必要なら権限チェックや関連データの処理を追加
        $user->delete();

        return Redirect::route('users.index')->with('success', 'ユーザーを削除しました。');
    }
}
