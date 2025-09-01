<?php

namespace App\Policies;

use App\Models\DailyNote;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class DailyNotePolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any daily notes.
     */
    public function viewAny(User $user)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('daily_note.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    /**
     * Determine whether the user can view the daily note.
     */
    public function view(User $user, DailyNote $note)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('daily_note.view');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    /**
     * Determine whether the user can create daily notes.
     */
    public function create(User $user)
    {
        try {
            return $user->hasRole('システム管理者') || $user->hasPermissionTo('daily_note.create');
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return $user->hasRole('システム管理者');
        }
    }

    /**
     * Only owner can update.
     */
    public function update(User $user, DailyNote $note)
    {
        return $user->id === $note->user_id;
    }

    /**
     * Only owner can delete.
     */
    public function delete(User $user, DailyNote $note)
    {
        return $user->id === $note->user_id;
    }
}
