<?php

namespace App\Policies;

use App\Models\User;
use App\Models\ShiftDetail;
use Illuminate\Auth\Access\HandlesAuthorization;

class ShiftDetailPolicy
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
            return $user->hasPermissionTo('shift.view') || $user->hasPermissionTo('shift.daily.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function view(User $user, ShiftDetail $shiftDetail)
    {
        // allow viewing if has general shift.view permission, daily timeline permission, or owns the record
        try {
            return $user->hasPermissionTo('shift.view')
                || $user->hasPermissionTo('shift.daily.view')
                || $user->id === $shiftDetail->user_id;
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->id === $shiftDetail->user_id;
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasPermissionTo('shift.create') || $user->hasPermissionTo('shift.daily.manage');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function update(User $user, ShiftDetail $shiftDetail)
    {
        // allow update if has permission, daily manage permission, or owns the record
        try {
            return $user->hasPermissionTo('shift.update')
                || $user->hasPermissionTo('shift.daily.manage')
                || $user->id === $shiftDetail->user_id;
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->id === $shiftDetail->user_id;
        }
    }

    public function delete(User $user, ShiftDetail $shiftDetail)
    {
        try {
            return $user->hasPermissionTo('shift.delete')
                || $user->hasPermissionTo('shift.daily.manage')
                || $user->id === $shiftDetail->user_id;
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->id === $shiftDetail->user_id;
        }
    }
}
