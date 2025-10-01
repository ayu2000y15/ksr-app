<?php

namespace App\Policies;

use App\Models\Poll;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class PollPolicy
{
    use HandlesAuthorization;

    /**
     * 匿名投票の詳細（誰が投票したか）を閲覧できるかを判定する
     *
     * @param  \App\Models\User  $user
     * @param  \App\Models\Poll  $poll
     * @return bool
     */
    public function viewAnonymousVotes(User $user, Poll $poll): bool
    {
        // そもそも匿名投票でなければ、このチェックは不要（常に可視としてtrueを返す）
        if (!$poll->is_anonymous) {
            return true;
        }

        // 投稿者本人か？
        if ($user->id === $poll->post->user_id) {
            return true;
        }

        // 管理者権限を持つユーザーか？
        // ここでは 'システム管理者' というロール名を例としています。
        // spatie/laravel-permission などのパッケージ利用を想定しています。
        // 実際のロール名に合わせて適宜変更してください。
        if ($user->hasRole('システム管理者')) {
            return true;
        }

        return false;
    }
}
