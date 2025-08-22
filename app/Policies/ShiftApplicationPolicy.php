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
        return $user->hasPermissionTo('shift_application.view');
    }

    public function view(User $user, ShiftApplication $application)
    {
        return $user->hasPermissionTo('shift_application.view');
    }

    public function create(User $user)
    {
        return $user->hasPermissionTo('shift_application.create');
    }

    public function update(User $user, ShiftApplication $application)
    {
        return $user->hasPermissionTo('shift_application.update');
    }

    public function delete(User $user, ShiftApplication $application)
    {
        return $user->hasPermissionTo('shift_application.delete');
    }
}
