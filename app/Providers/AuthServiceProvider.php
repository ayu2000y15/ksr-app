<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\DefaultShift;
use App\Policies\UserPolicy;
use App\Policies\RolePolicy;
use App\Policies\PermissionPolicy;
use App\Policies\ShiftPolicy;
use App\Policies\ShiftApplicationPolicy;
use App\Policies\UserShiftSettingPolicy;
use App\Policies\DefaultShiftPolicy;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array
     */
    protected $policies = [
        User::class => UserPolicy::class,
        Role::class => RolePolicy::class,
        Permission::class => PermissionPolicy::class,
        \App\Models\Shift::class => ShiftPolicy::class,
        \App\Models\ShiftApplication::class => ShiftApplicationPolicy::class,
        \App\Models\UserShiftSetting::class => UserShiftSettingPolicy::class,
        DefaultShift::class => DefaultShiftPolicy::class,
    \App\Models\ShiftDetail::class => \App\Policies\ShiftDetailPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot()
    {
        $this->registerPolicies();

        // Super-admin role bypass: users with role name 'システム管理者' are allowed everything
        Gate::before(function ($user, $ability) {
            Log::info('Gate::before called', [
                'user_id' => $user ? $user->id : null,
                'user_name' => $user ? $user->name : null,
                'ability' => $ability,
                'has_role' => $user ? $user->hasRole('システム管理者') : false,
            ]);

            if ($user && $user->hasRole('システム管理者')) {
                Log::info('Gate::before - システム管理者として許可');
                return true;
            }
        });
    }
}
