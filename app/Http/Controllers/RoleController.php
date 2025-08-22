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
        if (Auth::user() && Auth::user()->hasRole('システム管理者')) {
            return Role::with('permissions')->orderBy('id')->get();
        }
        
        $this->authorize('viewAny', Role::class);
        // Order by the order_column so frontend displays in saved order
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
