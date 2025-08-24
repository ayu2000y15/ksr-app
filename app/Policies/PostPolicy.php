<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Post;

class PostPolicy
{
    /** Determine whether the user can view any posts. */
    public function viewAny(User $user)
    {
        return true; // authenticated users can view in this app
    }

    /** Determine whether the user can view the post. */
    public function view(User $user, Post $post)
    {
        if ($post->is_public) return true;
        return $user->id === $post->user_id;
    }

    /** Determine whether the user can create posts. */
    public function create(User $user)
    {
        return $user != null;
    }

    /** Determine whether the user can update the post. */
    public function update(User $user, Post $post)
    {
        return $user->id === $post->user_id;
    }

    /** Determine whether the user can delete the post. */
    public function delete(User $user, Post $post)
    {
        return $user->id === $post->user_id;
    }
}
