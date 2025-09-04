<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;

class PostPinController extends Controller
{
    public function __construct()
    {
        // ensure user is authenticated via middleware in routes group
    }

    public function pin(Request $request, Post $post)
    {
        $user = $request->user();
        if (! $user) return response()->json(['message' => 'Unauthenticated'], 401);

        try {
            $post->pinnedByUsers()->syncWithoutDetaching([$user->id]);
            return response()->json(['message' => 'pinned'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to pin', 'error' => $e->getMessage()], 500);
        }
    }

    public function unpin(Request $request, Post $post)
    {
        $user = $request->user();
        if (! $user) return response()->json(['message' => 'Unauthenticated'], 401);

        try {
            $post->pinnedByUsers()->detach([$user->id]);
            return response()->json(['message' => 'unpinned'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to unpin', 'error' => $e->getMessage()], 500);
        }
    }
}
