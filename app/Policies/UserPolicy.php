<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class UserPolicy
{
    use HandlesAuthorization;

    /**
     * システム管理者は全ての操作を許可
     */
    public function before(User $user, string $ability): bool|null
    {
        if ($user->hasRole('システム管理者')) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user)
    {
        return $user->hasPermissionTo('user.view');
    }

    public function view(User $user, User $model)
    {
        return $user->hasPermissionTo('user.view');
    }

    public function create(User $user)
    {
        return $user->hasPermissionTo('user.create');
    }

    public function update(User $user, User $model)
    {
        return $user->hasPermissionTo('user.update');
    }

    public function delete(User $user, User $model)
    {
        return $user->hasPermissionTo('user.delete');
    }
}
