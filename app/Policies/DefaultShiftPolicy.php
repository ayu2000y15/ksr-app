<?php

namespace App\Policies;

use App\Models\User;
use App\Models\DefaultShift;
use Illuminate\Auth\Access\HandlesAuthorization;

class DefaultShiftPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('default_shift.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function view(User $user, DefaultShift $defaultShift)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('default_shift.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('default_shift.create');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function update(User $user, DefaultShift $defaultShift)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('default_shift.update');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function delete(User $user, DefaultShift $defaultShift)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('default_shift.delete');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }
}
