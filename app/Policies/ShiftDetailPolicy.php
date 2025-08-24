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
            return $user->hasPermissionTo('shift.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function view(User $user, ShiftDetail $shiftDetail)
    {
        // allow viewing if has general shift.view permission or owns the record
        try {
            return $user->hasPermissionTo('shift.view') || $user->id === $shiftDetail->user_id;
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->id === $shiftDetail->user_id;
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasPermissionTo('shift.create');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function update(User $user, ShiftDetail $shiftDetail)
    {
        // allow update if has permission or owns the record
        try {
            return $user->hasPermissionTo('shift.update') || $user->id === $shiftDetail->user_id;
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->id === $shiftDetail->user_id;
        }
    }

    public function delete(User $user, ShiftDetail $shiftDetail)
    {
        try {
            return $user->hasPermissionTo('shift.delete') || $user->id === $shiftDetail->user_id;
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->id === $shiftDetail->user_id;
        }
    }
}
