<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;

class SharePermissions
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        if (Auth::check()) {
            $user = Auth::user();
            /** @var \App\Models\User $user */

            // システム管理者の場合は全権限を持つとみなす
            $isSystemAdmin = $user instanceof \App\Models\User && $user->hasRole('システム管理者');

            // prepare flat permission names list for components that expect
            // `auth.permissions` as a string array (e.g. sidebar code)
            try {
                if ($isSystemAdmin) {
                    $flatPermissions = Permission::pluck('name')->unique()->values()->all();
                } else {
                    $flatPermissions = Permission::whereHas('roles.users', function ($q) use ($user) {
                        $q->where('users.id', $user->id);
                    })->pluck('name')->unique()->values()->all();
                }
            } catch (\Throwable $e) {
                // If permissions table is inconsistent or a permission name is missing for the guard,
                // do not break Inertia sharing — fall back to an empty permission list.
                $flatPermissions = [];
            }

            // safe permission checker: return false when the named permission does not exist
            $safeHas = function ($permName) use ($user, $isSystemAdmin) {
                if ($isSystemAdmin) return true;
                try {
                    return $user->hasPermissionTo($permName);
                } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
                    return false;
                }
            };

            Inertia::share([
                'auth.permissions' => $flatPermissions,
                'permissions' => [
                    'user' => [
                        'view' => $safeHas('user.view'),
                        'create' => $safeHas('user.create'),
                        'update' => $safeHas('user.update'),
                        'delete' => $safeHas('user.delete'),
                    ],
                    'role' => [
                        'view' => $safeHas('role.view'),
                        'create' => $safeHas('role.create'),
                        'update' => $safeHas('role.update'),
                        'delete' => $safeHas('role.delete'),
                    ],
                    'permission' => [
                        'view' => $safeHas('permission.view'),
                        'create' => $safeHas('permission.create'),
                        'update' => $safeHas('permission.update'),
                        'delete' => $safeHas('permission.delete'),
                    ],
                    // shift related permissions (used by shifts pages/components)
                    'shift' => [
                        'view' => $safeHas('shift.view'),
                        'create' => $safeHas('shift.create'),
                        'update' => $safeHas('shift.update'),
                        'delete' => $safeHas('shift.delete'),
                    ],
                    'shift_application' => [
                        'view' => $safeHas('shift_application.view'),
                        'create' => $safeHas('shift_application.create'),
                        'update' => $safeHas('shift_application.update'),
                        'delete' => $safeHas('shift_application.delete'),
                    ],
                    'default_shift' => [
                        'view' => $safeHas('default_shift.view'),
                        'create' => $safeHas('default_shift.create'),
                        'update' => $safeHas('default_shift.update'),
                        'delete' => $safeHas('default_shift.delete'),
                    ],
                    'user_shift_setting' => [
                        'view' => $safeHas('user_shift_setting.view'),
                        'create' => $safeHas('user_shift_setting.create'),
                        'update' => $safeHas('user_shift_setting.update'),
                        'delete' => $safeHas('user_shift_setting.delete'),
                    ],
                    'inventory' => [
                        'view' => $safeHas('inventory.view'),
                        'create' => $safeHas('inventory.create'),
                        'update' => $safeHas('inventory.update'),
                        'delete' => $safeHas('inventory.delete'),
                        'logs' => $safeHas('inventory.log.view'),
                    ],
                    'damaged_inventory' => [
                        'view' => $safeHas('damaged_inventory.view'),
                        'create' => $safeHas('damaged_inventory.create'),
                        'update' => $safeHas('damaged_inventory.update'),
                        'delete' => $safeHas('damaged_inventory.delete'),
                    ],
                    'properties' => [
                        'view' => $safeHas('properties.view'),
                        'create' => $safeHas('properties.create'),
                        'update' => $safeHas('properties.edit'),
                        'delete' => $safeHas('properties.delete'),
                        'reorder' => $safeHas('properties.reorder'),
                    ],
                    'task' => [
                        'view' => $safeHas('task.view'),
                        'create' => $safeHas('task.create'),
                        'update' => $safeHas('task.update'),
                        'delete' => $safeHas('task.delete'),
                    ],
                    'is_system_admin' => $isSystemAdmin,
                ],
            ]);
        } else {
            Inertia::share([
                'auth.permissions' => [],
                'permissions' => [
                    'user' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'role' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'permission' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'shift' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'shift_application' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'default_shift' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'user_shift_setting' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'is_system_admin' => false,
                ],
            ]);
        }

        return $next($request);
    }
}
