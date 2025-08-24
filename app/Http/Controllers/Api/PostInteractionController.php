<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Post;
use App\Models\Reaction;
use App\Models\PostView;
use Illuminate\Support\Facades\Auth;

class PostInteractionController extends Controller
{
    // GET /api/posts/{post}/reactions
    public function reactions(Post $post)
    {
        $data = $post->reactions()->with('user:id,name')->get()->map(function ($r) {
            return [
                'id' => $r->id,
                'emoji' => $r->emoji,
                'user' => ['id' => $r->user->id, 'name' => $r->user->name],
            ];
        });

        return response()->json(['data' => $data]);
    }

    // POST /api/posts/{post}/reactions  { emoji }
    public function toggleReaction(Request $request, Post $post)
    {
        $request->validate(['emoji' => 'required|string|max:64']);
        $user = Auth::user();

        // if the same emoji reaction exists, remove it (toggle off)
        $existing = $post->reactions()->where('user_id', $user->id)->where('emoji', $request->emoji)->first();
        if ($existing) {
            $existing->delete();
            $status = 'deleted';
        } else {
            // enforce single reaction per user per post: remove any other reactions by this user for this post
            $post->reactions()->where('user_id', $user->id)->delete();
            $post->reactions()->create(['user_id' => $user->id, 'emoji' => $request->emoji]);
            $status = 'created';
        }

        // return updated reactions list for the post
        $data = $post->reactions()->with('user:id,name')->get()->map(function ($r) {
            return [
                'id' => $r->id,
                'emoji' => $r->emoji,
                'user' => ['id' => $r->user->id, 'name' => $r->user->name],
            ];
        });

        return response()->json(['status' => $status, 'data' => $data]);
    }

    // GET /api/posts/{post}/views
    public function views(Post $post)
    {
        $data = $post->views()->with('user:id,name')->get()->map(function ($v) {
            return ['id' => $v->id, 'user' => ['id' => $v->user->id, 'name' => $v->user->name], 'created_at' => $v->created_at];
        });
        return response()->json(['data' => $data]);
    }

    // POST /api/posts/{post}/views -> register current user as viewer
    public function registerView(Request $request, Post $post)
    {
        $user = Auth::user();
        if (! $post->views()->where('user_id', $user->id)->exists()) {
            $post->views()->create(['user_id' => $user->id]);
        }
        return response()->json(['status' => 'ok']);
    }
}
