<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Post;
use Illuminate\Auth\Access\HandlesAuthorization;

class PostPolicy
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

    /** Determine whether the user can view any posts. */
    public function viewAny(User $user)
    {
        return true; // authenticated users can view in this app
    }

    /** Determine whether the user can view the post. */
    public function view(User $user, Post $post)
    {
        // システム管理者は全て閲覧可能（beforeメソッドで処理されるが、明示的に記載）
        if ($user->hasRole('システム管理者')) return true;

        // 公開投稿は誰でも閲覧可能
        if ($post->is_public) return true;

        // 下書きは作成者のみ閲覧可能
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
