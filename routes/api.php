<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\UserRoleController;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Temporarily use session-based auth for API routes during local testing
// so browser session cookies work reliably (revert to auth:sanctum for production).
Route::middleware(['web', 'auth'])->group(function () {
    // デバッグ用：現在のユーザー情報とロールを確認
    Route::get('/debug/user', function () {
        $user = Auth::user();
        return [
            'user' => $user,
            'roles' => $user->roles,
            'permissions' => $user->permissions,
            'has_system_admin_role' => $user->hasRole('システム管理者'),
        ];
    });

    // デバッグ用：システム管理者ロールの権限を確認
    Route::get('/debug/admin-role', function () {
        $adminRole = \Spatie\Permission\Models\Role::where('name', 'システム管理者')->first();
        return [
            'role' => $adminRole,
            'permissions' => $adminRole ? $adminRole->permissions : null,
            'permission_count' => $adminRole ? $adminRole->permissions->count() : 0,
        ];
    });

    // デバッグ用：権限チェックテスト
    Route::get('/debug/permission-test', function () {
        $user = Auth::user();
        return [
            'can_view_roles' => $user->can('viewAny', \Spatie\Permission\Models\Role::class),
            'can_view_permissions' => $user->can('viewAny', \Spatie\Permission\Models\Permission::class),
            'gate_allows_before' => \Illuminate\Support\Facades\Gate::forUser($user)->allows('viewAny', \Spatie\Permission\Models\Role::class),
        ];
    });

    // ユーザー一覧（ロール割り当て用）
    Route::get('/users', function () {
        // 一時的に権限チェックを無効化
        // $this->authorize('viewAny', User::class);
        return User::with('roles')->orderBy('name')->get();
    });

    // ロール管理
    Route::apiResource('roles', RoleController::class);
    Route::post('roles/reorder', [RoleController::class, 'reorder']);
    Route::post('roles/{role}/permissions', [RoleController::class, 'syncPermissions']);

    // 権限管理
    Route::apiResource('permissions', PermissionController::class);

    // ユーザーへのロール割り当て
    Route::post('users/{user}/roles', [UserRoleController::class, 'syncRoles']);
});
