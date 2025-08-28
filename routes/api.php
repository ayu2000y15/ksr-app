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
        return User::with('roles')->where('status', 'active')->orderBy('id')->get();
    });

    // アプリ内のアクティブユーザー一覧（入寮・退寮フォーム用）
    Route::get('/active-users', function () {
        // try status == 'active' first, fallback to all users
        $q = User::query();
        if (in_array('status', (new \ReflectionClass(User::class))->getDefaultProperties() ?: [])) {
            // If model has default properties, still attempt status filter — keep simple: try where status = 'active'
        }
        $users = User::where('status', 'active')->orderBy('id')->get(['id', 'name']);
        if ($users->count() === 0) {
            $users = User::orderBy('id')->get(['id', 'name']);
        }
        return ['users' => $users];
    });

    // ロール管理
    Route::apiResource('roles', RoleController::class);
    Route::post('roles/reorder', [RoleController::class, 'reorder']);
    Route::post('roles/{role}/permissions', [RoleController::class, 'syncPermissions']);

    // 権限管理
    Route::apiResource('permissions', PermissionController::class);

    // ユーザーへのロール割り当て
    Route::post('users/{user}/roles', [UserRoleController::class, 'syncRoles']);

    // 掲示板・投稿 API
    Route::apiResource('posts', \App\Http\Controllers\PostController::class);
    // 在庫管理 API
    Route::apiResource('inventory', \App\Http\Controllers\Api\InventoryController::class);
    Route::post('inventory/{inventory}/adjust', [\App\Http\Controllers\Api\InventoryController::class, 'adjustStock']);
    // サーバー側集計 API（月別カテゴリ・名称ごとの破損集計）
    Route::get('damaged-inventories/stats', [\App\Http\Controllers\Api\DamagedInventoryController::class, 'stats']);

    // 破損在庫管理 API
    Route::apiResource('damaged-inventories', \App\Http\Controllers\Api\DamagedInventoryController::class);
    // 投稿へのリアクションと既読
    Route::get('posts/{post}/reactions', [\App\Http\Controllers\Api\PostInteractionController::class, 'reactions']);
    Route::post('posts/{post}/reactions', [\App\Http\Controllers\Api\PostInteractionController::class, 'toggleReaction']);
    Route::get('posts/{post}/views', [\App\Http\Controllers\Api\PostInteractionController::class, 'views']);
    Route::post('posts/{post}/views', [\App\Http\Controllers\Api\PostInteractionController::class, 'registerView']);

    // 入寮登録 API（簡易実装） - 1レコードに複数ユーザーIDを保持
    // This POST endpoint also accepts an `id` to update an existing record (so the frontend can always POST for create/update).
    Route::post('/room-occupancies', function (\Illuminate\Http\Request $request) {
        $baseRules = [
            'property_id' => 'required|exists:properties,id',
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'required|exists:users,id',
            'move_in_date' => 'required|date',
            'move_out_date' => 'nullable|date',
            'move_out_confirm_user_id' => 'nullable|exists:users,id',
            'move_out_confirm_date' => 'nullable|date',
        ];

        // allow id for update
        $rules = array_merge($baseRules, ['id' => 'nullable|exists:room_occupancies,id']);

        $data = $request->validate($rules);

        // Authorization: require properties.create for new records, properties.edit for updates
        try {
            if (!empty($data['id'])) {
                // update: authorize against the related property
                $propertyForAuth = null;
                if (!empty($data['property_id'])) {
                    $propertyForAuth = \App\Models\Property::find($data['property_id']);
                }
                if ($propertyForAuth) {
                    \Illuminate\Support\Facades\Gate::forUser($request->user())->authorize('update', $propertyForAuth);
                } else {
                    // fallback: require general update capability
                    \Illuminate\Support\Facades\Gate::forUser($request->user())->authorize('update', \App\Models\Property::class);
                }
            } else {
                // create: require create permission
                \Illuminate\Support\Facades\Gate::forUser($request->user())->authorize('create', \App\Models\Property::class);
            }
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => '権限がありません'], 403);
        }

        if (!empty($data['id'])) {
            // update existing
            $occ = \App\Models\RoomOccupancy::find($data['id']);
            if (!$occ) {
                return response()->json(['message' => '指定の入寮レコードが見つかりません'], 404);
            }
            $occ->property_id = $data['property_id'];
            // Do not write to the deprecated user_id column; keep user_ids as the canonical source of truth
            $occ->user_ids = $data['user_ids'];
            $occ->move_in_date = $data['move_in_date'];
            $occ->move_out_date = $data['move_out_date'] ?? null;
            $occ->checkout_user_id = $data['move_out_confirm_user_id'] ?? null;
            $occ->checkout_date = $data['move_out_confirm_date'] ?? null;
            $occ->save();
            return response()->json(['message' => '入寮者情報を更新しました', 'room_occupancy' => $occ], 200);
        }

        // create new
        $occ = \App\Models\RoomOccupancy::create([
            'property_id' => $data['property_id'],
            // Intentionally do NOT set the deprecated user_id column here. Use user_ids exclusively.
            'user_ids' => $data['user_ids'],
            'move_in_date' => $data['move_in_date'],
            'move_out_date' => $data['move_out_date'] ?? null,
            'checkout_user_id' => $data['move_out_confirm_user_id'] ?? null,
            'checkout_date' => $data['move_out_confirm_date'] ?? null,
        ]);

        return response()->json(['message' => '入寮者を登録しました', 'room_occupancy' => $occ], 201);
    });

    // Delete room occupancy by id
    Route::delete('/room-occupancies/{id}', function (\Illuminate\Http\Request $request, $id) {
        $occ = \App\Models\RoomOccupancy::find($id);
        if (!$occ) {
            return response()->json(['message' => '指定の入寮レコードが見つかりません'], 404);
        }
        // Authorization: require properties.delete on the associated property
        try {
            $propertyForAuth = null;
            if (method_exists($occ, 'property') && $occ->property) {
                $propertyForAuth = $occ->property;
            } elseif (!empty($occ->property_id)) {
                $propertyForAuth = \App\Models\Property::find($occ->property_id);
            }
            if ($propertyForAuth) {
                \Illuminate\Support\Facades\Gate::forUser($request->user())->authorize('delete', $propertyForAuth);
            } else {
                \Illuminate\Support\Facades\Gate::forUser($request->user())->authorize('delete', \App\Models\Property::class);
            }
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => '権限がありません'], 403);
        }

        try {
            $occ->delete();
            return response()->json(['message' => '入寮者情報を削除しました'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => '削除に失敗しました'], 500);
        }
    });
});
