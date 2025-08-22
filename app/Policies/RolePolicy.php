<?php

namespace App\Policies;

use App\Models\User;
use Spatie\Permission\Models\Role; // 👈 念のためSpatieのモデルを指定
use Illuminate\Auth\Access\HandlesAuthorization;
use Illuminate\Support\Facades\Log;

class RolePolicy
{
    use HandlesAuthorization;

    /**
     * システム管理者は全ての操作を許可
     */
    public function before(User $user, string $ability): bool|null
    {
        // デバッグ用ログ
        Log::info('RolePolicy::before called', [
            'user_id' => $user->id,
            'user_name' => $user->name,
            'ability' => $ability,
            'has_role' => $user->hasRole('システム管理者'),
        ]);

        if ($user->hasRole('システム管理者')) {
            Log::info('RolePolicy::before - システム管理者として許可');
            return true;
        }

        return null;
    }

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('role.view');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Role $role): bool
    {
        return $user->hasPermissionTo('role.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasPermissionTo('role.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Role $role): bool
    {
        return $user->hasPermissionTo('role.update');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Role $role): bool
    {
        return $user->hasPermissionTo('role.delete');
    }
}
