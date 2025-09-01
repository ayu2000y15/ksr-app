<?php

namespace App\Http\Controllers;

use App\Models\DailyNoteComment;
use App\Models\DailyNote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DailyNoteCommentController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'daily_note_id' => 'required|exists:daily_notes,id',
            'body' => 'required|string',
            'quote_comment_id' => 'nullable|exists:daily_note_comments,id',
        ]);
        $user = $request->user();
        DB::beginTransaction();
        try {
            $comment = DailyNoteComment::create([
                'daily_note_id' => $data['daily_note_id'],
                'user_id' => $user->id,
                'body' => $data['body'],
                'quote_comment_id' => $data['quote_comment_id'] ?? null,
            ]);
            DB::commit();
            $comment->load(['user', 'quote']);
            return response()->json($comment, 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create comment', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id, Request $request)
    {
        $c = DailyNoteComment::find($id);
        if (!$c) return response()->json(['message' => 'Not found'], 404);
        if ($c->user_id !== $request->user()->id) return response()->json(['message' => 'Forbidden'], 403);
        $c->delete();
        return response()->noContent();
    }
}
