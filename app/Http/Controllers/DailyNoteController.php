<?php

namespace App\Http\Controllers;

use App\Models\DailyNote;
use App\Models\Tag;
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
        $this->authorize('viewAny', DailyNote::class);
        $month = $request->query('month');
        $q = $request->query('q'); // keyword
        $start = $request->query('start'); // YYYY-MM-DD
        $end = $request->query('end'); // YYYY-MM-DD

        $query = DailyNote::with(['user', 'attachments', 'comments.user', 'comments.quote', 'tags']);

        // date range: explicit start/end takes precedence
        if ($start && $end && preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            $query->whereBetween('date', [$start, $end]);
        } elseif ($month && preg_match('/^\d{4}-\d{2}$/', $month)) {
            // fallback: month param
            $query->whereBetween('date', ["$month-01", "$month-31"]);
        }

        // keyword search across note body and comment bodies
        if ($q && is_string($q)) {
            $keyword = "%" . str_replace('%', '\\%', $q) . "%";
            $query->where(function ($sub) use ($keyword) {
                $sub->where('body', 'like', $keyword)
                    ->orWhereHas('comments', function ($cq) use ($keyword) {
                        $cq->where('body', 'like', $keyword);
                    })
                    ->orWhereHas('tags', function ($tq) use ($keyword) {
                        $tq->where('name', 'like', $keyword);
                    });
            });
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
        // authorization: any authenticated user can create
        $this->authorize('create', DailyNote::class);
        DB::beginTransaction();
        try {
            $note = DailyNote::create(['date' => $data['date'], 'user_id' => $user->id, 'body' => $data['body']]);
            // extract #tags from body and attach
            if (!empty($data['body'])) {
                preg_match_all('/#([\p{L}0-9_\-]+)/u', $data['body'], $m);
                $tagIds = [];
                if (!empty($m[1])) {
                    foreach (array_unique($m[1]) as $raw) {
                        $name = trim($raw);
                        if ($name === '') continue;
                        $tag = Tag::firstOrCreate(['name' => $name]);
                        $tagIds[] = $tag->id;
                    }
                }
                if (!empty($tagIds)) {
                    $note->tags()->sync($tagIds);
                }
            }

            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $note->attachments()->create(['file_path' => $path, 'original_name' => $file->getClientOriginalName()]);
                }
            }
            DB::commit();
            $note->load(['user', 'attachments', 'comments.user', 'tags']);
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
        // authorize using policy (owner only)
        try {
            $this->authorize('delete', $note);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $note->delete();
        return response()->noContent();
    }

    // POST /api/daily-notes/{id} - update via POST to match frontend pattern
    public function update(Request $request, $id)
    {
        $note = DailyNote::find($id);
        if (!$note) return response()->json(['message' => 'Not found'], 404);
        // authorize using policy (owner only)
        try {
            $this->authorize('update', $note);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

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

            // extract #tags from body and sync
            if (isset($data['body'])) {
                preg_match_all('/#([\p{L}0-9_\-]+)/u', $data['body'], $m);
                $tagIds = [];
                if (!empty($m[1])) {
                    foreach (array_unique($m[1]) as $raw) {
                        $name = trim($raw);
                        if ($name === '') continue;
                        $tag = Tag::firstOrCreate(['name' => $name]);
                        $tagIds[] = $tag->id;
                    }
                }
                $note->tags()->sync($tagIds);
            }

            // store new attachments
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $note->attachments()->create(['file_path' => $path, 'original_name' => $file->getClientOriginalName()]);
                }
            }

            DB::commit();
            $note->load(['user', 'attachments', 'comments.user', 'comments.quote', 'tags']);
            return response()->json($note, 200);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update note', 'error' => $e->getMessage()], 500);
        }
    }
}
