<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    // ロール一覧取得
    public function index()
    {
        // システム管理者の場合は権限チェックをスキップ
        $user = Auth::user();
        if ($user && $user->hasRole('システム管理者')) {
            return Role::with('permissions')->orderBy('id')->get();
        }

        $this->authorize('viewAny', Role::class);

        // 要件: 次のいずれかの権限を持つ閲覧者は、自分のロールだけでなく全てのロールを閲覧できるようにする。
        // チェックする権限キー（合理的な推定）:
        $checkPerms = [
            'role.viewAny',
            'role.view',
            'role.assign',
            'role.update',
            'user.view',
            'user.update',
        ];

        $canSeeAll = false;
        if ($user) {
            foreach ($checkPerms as $p) {
                try {
                    if ($user->hasPermissionTo($p)) {
                        $canSeeAll = true;
                        break;
                    }
                } catch (\Exception $e) {
                    // ignore missing permission entries
                }
            }
        }

        if ($user && $canSeeAll) {
            return Role::with('permissions')->orderBy('id')->get();
        }

        // デフォルト: 非管理者かつ権限が無ければ、自分が所属しているロールのみ返す
        if ($user) {
            $roleIds = $user->roles->pluck('id')->values()->all();
            return Role::with('permissions')->whereIn('id', $roleIds)->orderBy('id')->get();
        }

        return Role::with('permissions')->orderBy('id')->get();
    }

    // ロール作成
    public function store(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            $role = Role::create($request->only(['name',]));
            return response()->json($role, 201);
        }

        $this->authorize('create', Role::class);
        $role = Role::create($request->only(['name',]));
        return response()->json($role, 201);
    }

    // ロール詳細取得
    public function show(Role $role)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            return $role->load('permissions');
        }

        $this->authorize('view', $role);
        return $role->load('permissions');
    }

    // ロール更新
    public function update(Request $request, Role $role)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            $role->update($request->only(['name']));
            return response()->json($role);
        }

        $this->authorize('update', $role);
        $role->update($request->only(['name']));
        return response()->json($role);
    }

    // ロール削除
    public function destroy(Role $role)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            $role->delete();
            return response()->json(null, 204);
        }

        $this->authorize('delete', $role);
        $role->delete();
        return response()->json(null, 204);
    }

    // 権限の割り当て
    public function syncPermissions(Request $request, Role $role)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            $role->syncPermissions($request->input('permission_ids', []));
            return response()->json($role->load('permissions'));
        }

        $this->authorize('update', $role);
        // 👈 メソッド名をパッケージ標準の syncPermissions に変更
        $role->syncPermissions($request->input('permission_ids', []));
        return response()->json($role->load('permissions'));
    }

    // // 並び順を保存
    // public function reorder(Request $request)
    // {
    //     $order = $request->input('order', []);

    //     DB::transaction(function () use ($order) {
    //         foreach ($order as $index => $id) {
    //             Role::where('id', $id)->update(['order_column' => $index]);
    //         }
    //     });

    //     return response()->json(['status' => 'ok']);
    // }
}
