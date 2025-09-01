<?php

namespace App\Http\Controllers;

use App\Models\DailyNote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Services\AttachmentService;

class DailyNoteController extends Controller
{
    protected $attachmentService;

    public function __construct(AttachmentService $attachmentService)
    {
        $this->attachmentService = $attachmentService;
    }

    // GET /api/daily-notes?month=YYYY-MM
    public function index(Request $request)
    {
        $month = $request->query('month');
        $query = DailyNote::with(['user', 'attachments', 'comments.user', 'comments.quote']);
        if ($month && preg_match('/^\d{4}-\d{2}$/', $month)) {
            $query->whereBetween('date', ["$month-01", "$month-31"]);
        }
        $notes = $query->orderBy('date', 'desc')->orderBy('created_at', 'desc')->get();
        return response()->json(['notes' => $notes]);
    }

    // POST /api/daily-notes
    public function store(Request $request)
    {
        $data = $request->validate([
            'date' => 'required|date',
            'body' => 'required|string',
        ]);

        $user = $request->user();
        DB::beginTransaction();
        try {
            $note = DailyNote::create(['date' => $data['date'], 'user_id' => $user->id, 'body' => $data['body']]);
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $note->attachments()->create(['file_path' => $path, 'original_name' => $file->getClientOriginalName()]);
                }
            }
            DB::commit();
            $note->load(['user', 'attachments', 'comments.user']);
            return response()->json($note, 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create note', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id, Request $request)
    {
        $note = DailyNote::find($id);
        if (!$note) return response()->json(['message' => 'Not found'], 404);
        // allow delete only by owner
        if ($note->user_id !== $request->user()->id) return response()->json(['message' => 'Forbidden'], 403);
        $note->delete();
        return response()->noContent();
    }

    // POST /api/daily-notes/{id} - update via POST to match frontend pattern
    public function update(Request $request, $id)
    {
        $note = DailyNote::find($id);
        if (!$note) return response()->json(['message' => 'Not found'], 404);
        // only owner can update
        if ($note->user_id !== $request->user()->id) return response()->json(['message' => 'Forbidden'], 403);

        $data = $request->validate([
            'body' => 'required|string',
            'deleted_attachment_ids' => 'nullable|array',
            'deleted_attachment_ids.*' => 'integer',
        ]);

        DB::beginTransaction();
        try {
            $note->body = $data['body'];
            $note->save();

            // delete attachments if requested
            if (!empty($data['deleted_attachment_ids'])) {
                foreach ($data['deleted_attachment_ids'] as $aid) {
                    $att = $note->attachments()->where('id', $aid)->first();
                    if ($att) {
                        Storage::disk('public')->delete($att->file_path);
                        $att->delete();
                    }
                }
            }

            // store new attachments
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $note->attachments()->create(['file_path' => $path, 'original_name' => $file->getClientOriginalName()]);
                }
            }

            DB::commit();
            $note->load(['user', 'attachments', 'comments.user', 'comments.quote']);
            return response()->json($note, 200);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update note', 'error' => $e->getMessage()], 500);
        }
    }
}
