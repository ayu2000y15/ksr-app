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
            if ($isSystemAdmin) {
                $flatPermissions = Permission::pluck('name')->unique()->values()->all();
            } else {
                $flatPermissions = Permission::whereHas('roles.users', function ($q) use ($user) {
                    $q->where('users.id', $user->id);
                })->pluck('name')->unique()->values()->all();
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
                    'is_system_admin' => false,
                ],
            ]);
        }

        return $next($request);
    }
}
