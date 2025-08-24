<?php

namespace App\Policies;

use App\Models\User;
use App\Models\ShiftApplication;
use Illuminate\Auth\Access\HandlesAuthorization;

class ShiftApplicationPolicy
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
            return $user->hasPermissionTo('shift_application.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function view(User $user, ShiftApplication $application)
    {
        try {
            return $user->hasPermissionTo('shift_application.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasPermissionTo('shift_application.create');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function update(User $user, ShiftApplication $application)
    {
        try {
            return $user->hasPermissionTo('shift_application.update');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function delete(User $user, ShiftApplication $application)
    {
        try {
            return $user->hasPermissionTo('shift_application.delete');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }
}
