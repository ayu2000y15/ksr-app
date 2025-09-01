<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    /**
     * Determine whether the user can view any tasks.
     */
    public function viewAny(User $user)
    {
        // users with permission 'task.view' can view task lists
        return $user->hasPermissionTo('task.view');
    }

    /**
     * Determine whether the user can view the task.
     */
    public function view(User $user, Task $task)
    {
        // public tasks are viewable
        if ($task->is_public) return true;

        // creator can view
        if ($task->user_id && $user->id == $task->user_id) return true;

        // assignees can view
        if (is_array($task->user_ids) && in_array($user->id, $task->user_ids)) return true;

        // users with explicit permission
        return $user->hasPermissionTo('task.view');
    }

    /**
     * Determine whether the user can create tasks.
     */
    public function create(User $user)
    {
        return $user->hasPermissionTo('task.create');
    }

    /**
     * Determine whether the user can update the task.
     */
    public function update(User $user, Task $task)
    {
        // creator or users with permission
        if ($task->user_id && $user->id == $task->user_id) return true;
        return $user->hasPermissionTo('task.update');
    }

    /**
     * Determine whether the user can delete the task.
     */
    public function delete(User $user, Task $task)
    {
        // only creator or users with delete permission
        if ($task->user_id && $user->id == $task->user_id) return true;
        return $user->hasPermissionTo('task.delete');
    }
}
