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
use App\Policies\AnnouncementPolicy;
use App\Models\Poll;
use App\Policies\PollPolicy;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array
     */
    protected $policies = [
        \App\Models\Post::class => \App\Policies\PostPolicy::class,
        \App\Models\Task::class => \App\Policies\TaskPolicy::class,
        User::class => UserPolicy::class,
        Role::class => RolePolicy::class,
        Permission::class => PermissionPolicy::class,
        \App\Models\Shift::class => ShiftPolicy::class,
        \App\Models\ShiftApplication::class => ShiftApplicationPolicy::class,
        \App\Models\UserShiftSetting::class => UserShiftSettingPolicy::class,
        DefaultShift::class => DefaultShiftPolicy::class,
        \App\Models\ShiftDetail::class => \App\Policies\ShiftDetailPolicy::class,
        \App\Models\Property::class => \App\Policies\PropertyPolicy::class,
        \App\Models\InventoryItem::class => \App\Policies\InventoryPolicy::class,
        \App\Models\DailyNote::class => \App\Policies\DailyNotePolicy::class,
        \App\Models\Announcement::class => AnnouncementPolicy::class,
        \Spatie\Activitylog\Models\Activity::class => \App\Policies\ActivityLogPolicy::class,
        Poll::class => PollPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot()
    {
        $this->registerPolicies();

        // Super-admin role bypass: users with role name 'システム管理者' are allowed everything
        Gate::before(function ($user, $ability) {

            if ($user && $user->hasRole('システム管理者')) {
                return true;
            }
        });
    }
}
