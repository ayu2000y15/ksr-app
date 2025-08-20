<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
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
            ->paginate(50) // ページネーションを追加
            ->withQueryString(); // クエリパラメータを維持

        return Inertia::render('Users/Index', [
            'users' => $users,
            'queryParams' => $request->query() ?: null, // 現在のクエリパラメータを渡す
        ]);
    }

    /**
     * ユーザー作成フォームを表示します。
     */
    public function create()
    {
        return Inertia::render('Users/Create');
    }

    /**
     * 新しいユーザーを作成し、保存します。
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:' . User::class,
            'status' => 'required|in:active,retired,shared',
            'phone_number' => 'nullable|string|max:20',
            'line_name' => 'nullable|string|max:255',
            'memo' => 'nullable|string',
        ]);

        // 仮パスワードを生成
        $temporaryPassword = Str::random(12);

        User::create([
            'name' => $request->name,
            'email' => $request->email,
            'status' => $request->status,
            'phone_number' => $request->phone_number,
            'line_name' => $request->line_name,
            'memo' => $request->memo,
            'password' => Hash::make($temporaryPassword),
            'must_change_password' => true,
        ]);

        // TODO: 作成したユーザーに仮パスワードを通知するメール送信処理を実装
        // Mail::to($request->email)->send(new UserCreatedMail($temporaryPassword));

        return Redirect::route('users.index')->with('success', 'ユーザーが作成されました。');
    }
}
