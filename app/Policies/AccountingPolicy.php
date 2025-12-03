<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class AccountingPolicy
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

    /**
     * 経理ページの表示許可
     */
    public function view(User $user): bool
    {
        try {
            return $user->hasPermissionTo('accounting.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }
}
