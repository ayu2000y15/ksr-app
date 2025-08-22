<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserRoleController extends Controller
{
    // ユーザーのロール一覧取得
    public function index(User $user)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('view', $user);
        }
        return $user->roles;
    }

    // ユーザーにロールを割り当て
    public function syncRoles(Request $request, User $user)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            // システム管理者の場合は権限チェックをバイパス
        } else {
            $this->authorize('update', $user);
        }

        $request->validate([
            'role_ids' => 'array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $roleIds = $request->input('role_ids', []);
        $user->syncRoles($roleIds);

        return response()->json([
            'message' => 'ロールを更新しました。',
            'user' => $user->load('roles'),
        ]);
    }
}
