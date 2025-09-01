<?php

namespace App\Http\Controllers;

use App\Models\DailyReport;
use App\Models\Tag;
use App\Models\Attachment;
use App\Services\AttachmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DailyReportController extends Controller
{
    protected $attachmentService;

    public function __construct(AttachmentService $attachmentService)
    {
        $this->attachmentService = $attachmentService;
    }
    public function index(Request $request)
    {
        // API/json list
        $user = $request->user();
        // include attachments and tags so the API index returns them for frontend
        $query = DailyReport::with(['user', 'attachments', 'tags']);
        // allow simple filters like ?date=2025-09-01
        if ($request->has('date')) {
            $query->whereDate('date', $request->query('date'));
        }
        $reports = $query->orderBy('date', 'desc')->paginate(15);
        return response()->json($reports);
    }

    // Inertia page
    public function indexPage()
    {
        return Inertia::render('daily-reports/index');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'nullable|string|max:255',
            'date' => 'required|date',
            'body' => 'nullable|string',
            'is_public' => 'boolean',
            'tags' => 'nullable|string', // comma-separated from client
        ]);

        $user = $request->user();
        DB::beginTransaction();
        try {
            $report = DailyReport::create([
                'user_id' => $user->id,
                'title' => $data['title'] ?? null,
                'date' => $data['date'],
                'body' => $data['body'] ?? null,
                'is_public' => $data['is_public'] ?? false,
            ]);

            // tags: client sends comma-separated string; create or find tags and attach
            if (!empty($data['tags'])) {
                $raw = $data['tags'];
                $parts = preg_split('/[,，\s]+/', trim($raw));
                $tagIds = [];
                foreach ($parts as $p) {
                    $name = trim($p);
                    if ($name === '') continue;
                    $tag = Tag::firstOrCreate(['name' => $name]);
                    $tagIds[] = $tag->id;
                }
                if (!empty($tagIds)) {
                    $report->tags()->sync($tagIds);
                }
            }

            // attachments: handle uploaded files under 'attachments[]'
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $report->attachments()->create([
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                }
            }
            DB::commit();
            return response()->json($report, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create report', 'error' => $e->getMessage()], 500);
        }
    }

    public function show(DailyReport $dailyReport)
    {
        $dailyReport->load(['user', 'attachments', 'tags']);
        return response()->json($dailyReport);
    }

    public function update(Request $request, $id)
    {
        $report = DailyReport::find($id);
        if (!$report) {
            return response()->json(['message' => '指定の日報が見つかりません'], 404);
        }

        $data = $request->validate([
            'title' => 'nullable|string|max:255',
            'body' => 'nullable|string',
            'is_public' => 'boolean',
            'tags' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $report->title = $data['title'] ?? $report->title;
            $report->body = $data['body'] ?? $report->body;
            if (isset($data['is_public'])) $report->is_public = $data['is_public'];
            $report->save();

            // tags
            if (isset($data['tags'])) {
                $raw = $data['tags'] ?? '';
                $parts = preg_split('/[,，\s]+/', trim($raw));
                $tagIds = [];
                foreach ($parts as $p) {
                    $name = trim($p);
                    if ($name === '') continue;
                    $tag = Tag::firstOrCreate(['name' => $name]);
                    $tagIds[] = $tag->id;
                }
                $report->tags()->sync($tagIds);
            }

            // new attachments
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $this->attachmentService->store($file);
                    $report->attachments()->create([
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                }
            }

            // handle deletion of existing attachments requested by client
            $deleted = $request->input('deleted_attachment_ids', []);
            if (is_array($deleted) && count($deleted) > 0) {
                foreach ($deleted as $attId) {
                    $att = $report->attachments()->where('id', $attId)->first();
                    if ($att) {
                        // delete file from public disk
                        Storage::disk('public')->delete($att->file_path);
                        $att->delete();
                    }
                }
            }

            DB::commit();
            $report->load(['user', 'attachments', 'tags']);
            return response()->json($report, 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => '更新に失敗しました', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy(DailyReport $dailyReport)
    {
        $dailyReport->delete();
        return response()->json(['message' => 'deleted']);
    }
}
