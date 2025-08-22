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
        return $user->hasRole('システム管理者') || $user->can('default_shift.view');
    }

    public function view(User $user, DefaultShift $defaultShift)
    {
        return $user->hasRole('システム管理者') || $user->can('default_shift.view');
    }

    public function create(User $user)
    {
        return $user->hasRole('システム管理者') || $user->can('default_shift.create');
    }

    public function update(User $user, DefaultShift $defaultShift)
    {
        return $user->hasRole('システム管理者') || $user->can('default_shift.update');
    }

    public function delete(User $user, DefaultShift $defaultShift)
    {
        return $user->hasRole('システム管理者') || $user->can('default_shift.delete');
    }
}
