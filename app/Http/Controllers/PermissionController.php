<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    // 権限一覧取得
    public function index()
    {
        // システム管理者の場合は権限チェックをバイパス
        if (Auth::user()->hasRole('システム管理者')) {
            return Permission::with('roles')->get();
        }
        
        $this->authorize('viewAny', Permission::class);
        return Permission::with('roles')->get();
    }

    // 権限作成
    public function store(Request $request)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            $permission = Permission::create($request->only(['name', 'description']));
            return response()->json($permission, 201);
        }
        
        $this->authorize('create', Permission::class);
        $permission = Permission::create($request->only(['name', 'description']));
        return response()->json($permission, 201);
    }

    // 権限詳細取得
    public function show(Permission $permission)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            return $permission->load('roles');
        }
        
        $this->authorize('view', $permission);
        return $permission->load('roles');
    }

    // 権限更新
    public function update(Request $request, Permission $permission)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            $permission->update($request->only(['name', 'description']));
            return response()->json($permission);
        }
        
        $this->authorize('update', $permission);
        $permission->update($request->only(['name', 'description']));
        return response()->json($permission);
    }

    // 権限削除
    public function destroy(Permission $permission)
    {
        if (Auth::user()->hasRole('システム管理者')) {
            $permission->delete();
            return response()->json(null, 204);
        }
        
        $this->authorize('delete', $permission);
        $permission->delete();
        return response()->json(null, 204);
    }
}
