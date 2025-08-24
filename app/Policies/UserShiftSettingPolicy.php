<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserShiftSetting;

class UserShiftSettingPolicy
{
    public function viewAny(User $user)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('user_shift_setting.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function view(User $user, UserShiftSetting $model)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('user_shift_setting.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function create(User $user)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('user_shift_setting.create');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function update(User $user, UserShiftSetting $model)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('user_shift_setting.update');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    public function delete(User $user, UserShiftSetting $model)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('user_shift_setting.delete');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }
}
