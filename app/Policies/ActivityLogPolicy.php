<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ActivityLogPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view activity logs.
     */
    public function viewAny(?User $user): bool
    {
        try {
            if (! $user) return false;
            // If using spatie/permission, check permission name 'activitylog.view'
            if (method_exists($user, 'hasPermissionTo')) {
                return $user->hasPermissionTo('activitylog.view');
            }
            // Fallback: allow if user is admin flag exists
            return property_exists($user, 'is_admin') ? (bool) $user->is_admin : false;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
