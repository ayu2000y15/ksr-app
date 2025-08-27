<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Property;
use Illuminate\Auth\Access\HandlesAuthorization;

class PropertyPolicy
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
            return $user->hasPermissionTo('properties.view');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function view(User $user, ?Property $property = null)
    {
        try {
            return $user->hasPermissionTo('properties.view');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasPermissionTo('properties.create');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function update(User $user, ?Property $property = null)
    {
        try {
            return $user->hasPermissionTo('properties.edit');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function delete(User $user, ?Property $property = null)
    {
        try {
            return $user->hasPermissionTo('properties.delete');
        } catch (\Exception $e) {
            return false;
        }
    }

    public function reorder(User $user)
    {
        try {
            return $user->hasPermissionTo('properties.reorder');
        } catch (\Exception $e) {
            return false;
        }
    }
}
