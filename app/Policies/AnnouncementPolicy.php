<?php

namespace App\Policies;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class AnnouncementPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can create announcements.
     * この権限があれば編集・削除も許可するポリシー設計です。
     */
    public function create(User $user)
    {
        // Spatie permissions を使っている前提で 'announcement.create' 権限を確認
        try {
            return $user->hasPermissionTo('announcement.create');
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Determine whether the user can update the announcement.
     * ここでは create が許可されていれば更新可能とする
     */
    public function update(User $user, Announcement $announcement)
    {
        return $this->create($user);
    }

    /**
     * Determine whether the user can delete the announcement.
     * ここでは create が許可されていれば削除可能とする
     */
    public function delete(User $user, Announcement $announcement)
    {
        return $this->create($user);
    }

    /**
     * Viewing announcements is open to all users per requirement; no gate here.
     */
    public function view(?User $user, Announcement $announcement)
    {
        return true;
    }
}
