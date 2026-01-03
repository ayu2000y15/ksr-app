<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Shift;
use Illuminate\Auth\Access\HandlesAuthorization;

class ShiftPolicy
{
    use HandlesAuthorization;

    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('システム管理者')) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user)
    {
        try {
            return $user->hasPermissionTo('shift.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function view(User $user, Shift $shift)
    {
        try {
            return $user->hasPermissionTo('shift.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function create(User $user)
    {
        try {
            // Allow users with shift.create or shift.view permission to create shifts
            return $user->hasPermissionTo('shift.create') || $user->hasPermissionTo('shift.daily.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function update(User $user, ?Shift $shift = null)
    {
        try {
            return $user->hasPermissionTo('shift.update');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function delete(User $user, ?Shift $shift = null)
    {
        try {
            return $user->hasPermissionTo('shift.delete');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }
}
