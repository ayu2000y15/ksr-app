<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserShiftSetting;

class UserShiftSettingPolicy
{
    public function viewAny(User $user)
    {
        return $user->hasRole('システム管理者') || $user->can('user_shift_setting.view');
    }

    public function view(User $user, UserShiftSetting $model)
    {
        return $user->hasRole('システム管理者') || $user->can('user_shift_setting.view');
    }

    public function create(User $user)
    {
        return $user->hasRole('システム管理者') || $user->can('user_shift_setting.create');
    }

    public function update(User $user, UserShiftSetting $model)
    {
        return $user->hasRole('システム管理者') || $user->can('user_shift_setting.update');
    }

    public function delete(User $user, UserShiftSetting $model)
    {
        return $user->hasRole('システム管理者') || $user->can('user_shift_setting.delete');
    }
}
