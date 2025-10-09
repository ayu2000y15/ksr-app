<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, (int) $request->query('per_page', 5));
        $page = max(1, (int) $request->query('page', 1));
        $query = Announcement::with('user')->orderBy('created_at', 'desc');
        $items = $query->skip(($page - 1) * $perPage)->take($perPage)->get();
        $total = $query->count();
        $user = Auth::user();
        $readMap = [];
        if ($user) {
            $reads = \App\Models\AnnouncementRead::whereIn('announcement_id', $items->pluck('id')->toArray())
                ->where('user_id', $user->id)
                ->pluck('read_at', 'announcement_id')
                ->toArray();
            $readMap = $reads;
        }

        $announcements = $items->map(function ($a) use ($readMap) {
            return array_merge($a->toArray(), ['read_by_current_user' => isset($readMap[$a->id]) && $readMap[$a->id] !== null]);
        })->all();

        return response()->json(['announcements' => $announcements, 'total' => $total, 'page' => $page, 'per_page' => $perPage]);
    }

    public function markRead(Request $request, $id)
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'unauthenticated'], 401);

        $ann = Announcement::find($id);
        if (!$ann) return response()->json(['message' => 'not_found'], 404);

        $read = \App\Models\AnnouncementRead::firstOrCreate(
            ['announcement_id' => $ann->id, 'user_id' => $user->id],
            ['read_at' => now()]
        );
        // ensure read_at is set
        if (!$read->read_at) {
            $read->read_at = now();
            $read->save();
        }

        return response()->json(['ok' => true]);
    }

    // update announcement (only author)
    public function update(Request $request, $id)
    {
        $this->validate($request, [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
        ]);

        $ann = Announcement::find($id);
        if (!$ann) return response()->json(['message' => 'not_found'], 404);

        $user = Auth::user();
        if (!$user || $ann->user_id !== $user->id) {
            return response()->json(['message' => 'forbidden'], 403);
        }

        $ann->title = $request->input('title');
        $ann->content = $request->input('content');
        $ann->save();

        return response()->json(['announcement' => $ann->load('user')], 200);
    }

    // delete announcement (only author)
    public function destroy(Request $request, $id)
    {
        $ann = Announcement::find($id);
        if (!$ann) return response()->json(['message' => 'not_found'], 404);

        $user = Auth::user();
        if (!$user || $ann->user_id !== $user->id) {
            return response()->json(['message' => 'forbidden'], 403);
        }

        try {
            $ann->delete();
            return response()->json(['ok' => true], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'delete_failed'], 500);
        }
    }

    public function store(Request $request)
    {
        $this->validate($request, [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
        ]);

        $user = Auth::user();

        $ann = Announcement::create([
            'user_id' => $user ? $user->id : null,
            'title' => $request->input('title'),
            'content' => $request->input('content'),
        ]);

        return response()->json(['announcement' => $ann], 201);
    }
}
