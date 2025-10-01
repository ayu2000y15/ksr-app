<?php

namespace App\Http\Controllers;

use App\Models\Poll;
use App\Models\PollVote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class PollController extends Controller
{
    /**
     * 投票を記録する
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Poll  $poll
     * @return \Illuminate\Http\JsonResponse
     */
    public function vote(Request $request, Poll $poll)
    {
        $user = Auth::user();

        // 投票期限のチェック
        if ($poll->expires_at && $poll->expires_at->isPast()) {
            return response()->json(['message' => 'この投票は終了しました。'], 403);
        }

        $request->validate([
            'option_ids' => ['required', 'array', $poll->allow_multiple_votes ? '' : 'size:1'],
            'option_ids.*' => ['required', Rule::exists('poll_options', 'id')->where('poll_id', $poll->id)],
        ]);

        // 単一投票の場合、過去の投票を削除
        if (!$poll->allow_multiple_votes) {
            $poll->votes()->where('user_id', $user->id)->delete();
        }

        // 新しい投票を記録
        foreach ($request->input('option_ids') as $optionId) {
            // 既に投票済みの場合はスキップ（複数投票の場合）
            $existing = PollVote::where('poll_option_id', $optionId)->where('user_id', $user->id)->exists();
            if ($existing) {
                continue;
            }

            PollVote::create([
                'poll_id' => $poll->id,
                'poll_option_id' => $optionId,
                'user_id' => $user->id,
            ]);
        }

        // 最新の投票情報を含んだPostを返す
        $post = $poll->post->load(['poll.options.votes.user']);

        return response()->json($post);
    }

    /**
     * 現在ユーザーのこの投票に対する投票を取り消す（自分の投票のみ）
     *
     * @param \Illuminate\Http\Request $request
     * @param \App\Models\Poll $poll
     * @return \Illuminate\Http\JsonResponse
     */
    public function reset(Request $request, Poll $poll)
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // 投票期限を過ぎていれば取り消し不可
        if ($poll->expires_at && $poll->expires_at->isPast()) {
            return response()->json(['message' => 'この投票は既に終了しています。'], 403);
        }

        // 現在ユーザーの投票のみを削除
        \App\Models\PollVote::where('poll_id', $poll->id)->where('user_id', $user->id)->delete();

        // 更新された投稿を返す（投票とオプションのリレーションを含む）
        $post = $poll->post->load(['poll.options.votes.user']);

        return response()->json($post);
    }
}
