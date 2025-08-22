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

            Inertia::share([
                'auth.permissions' => $flatPermissions,
                'permissions' => [
                    'user' => [
                        'view' => $isSystemAdmin || $user->hasPermissionTo('user.view'),
                        'create' => $isSystemAdmin || $user->hasPermissionTo('user.create'),
                        'update' => $isSystemAdmin || $user->hasPermissionTo('user.update'),
                        'delete' => $isSystemAdmin || $user->hasPermissionTo('user.delete'),
                    ],
                    'role' => [
                        'view' => $isSystemAdmin || $user->hasPermissionTo('role.view'),
                        'create' => $isSystemAdmin || $user->hasPermissionTo('role.create'),
                        'update' => $isSystemAdmin || $user->hasPermissionTo('role.update'),
                        'delete' => $isSystemAdmin || $user->hasPermissionTo('role.delete'),
                    ],
                    'permission' => [
                        'view' => $isSystemAdmin || $user->hasPermissionTo('permission.view'),
                        'create' => $isSystemAdmin || $user->hasPermissionTo('permission.create'),
                        'update' => $isSystemAdmin || $user->hasPermissionTo('permission.update'),
                        'delete' => $isSystemAdmin || $user->hasPermissionTo('permission.delete'),
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
