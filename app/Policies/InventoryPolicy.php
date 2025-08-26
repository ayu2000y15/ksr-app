<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class InventoryPolicy
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
            return $user->hasPermissionTo('inventory.view');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function view(User $user)
    {
        try {
            return $user->hasPermissionTo('inventory.view');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasPermissionTo('inventory.create');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function update(User $user)
    {
        try {
            return $user->hasPermissionTo('inventory.update');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function delete(User $user)
    {
        try {
            return $user->hasPermissionTo('inventory.delete');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function viewLogs(User $user)
    {
        try {
            return $user->hasPermissionTo('inventory.log.view');
        } catch (\Exception $e) {
            return false;
        }
    }
}
