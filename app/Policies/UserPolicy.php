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
        try {
            return $user->hasPermissionTo('user.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function view(User $user, User $model)
    {
        try {
            return $user->hasPermissionTo('user.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasPermissionTo('user.create');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function update(User $user, User $model)
    {
        try {
            return $user->hasPermissionTo('user.update');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    public function delete(User $user, User $model)
    {
        try {
            return $user->hasPermissionTo('user.delete');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }
}
