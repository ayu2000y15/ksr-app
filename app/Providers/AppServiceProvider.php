<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Note: auth.permissions is now shared from the SharePermissions middleware

        // Also share whether the current user is a system administrator so the frontend
        // can bypass permission checks reliably (some shares may override nested auth objects).
        Inertia::share('auth.isSuperAdmin', function () {
            $user = Auth::user();
            if (! $user) {
                return false;
            }

            $isSuper = DB::table('roles')
                ->join('role_user', 'roles.id', '=', 'role_user.role_id')
                ->where('role_user.user_id', $user->id)
                ->where('roles.name', 'システム管理者')
                ->exists();

            return $isSuper;
        });
    }
}
