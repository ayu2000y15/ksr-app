<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\User;
use App\Models\TaskCategory;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;

class TaskController
{
    public function index(Request $request)
    {
        $q = Task::query();
        // optional filter: date range or user
        if ($request->has('user_id')) {
            $uid = (int)$request->query('user_id');
            $q->whereJsonContains('user_ids', $uid);
        }

        // sorting: accept ?sort=...&direction=asc|desc
        $allowed = ['id', 'user_id', 'task_category_id', 'title', 'start_at', 'status', 'assignee'];
        $sort = $request->query('sort');
        $dir = strtolower($request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';

        if (in_array($sort, $allowed, true)) {
            switch ($sort) {
                case 'id':
                    $q->orderBy('id', $dir);
                    break;
                case 'title':
                    $q->orderBy('title', $dir);
                    break;
                case 'start_at':
                    $q->orderBy('start_at', $dir);
                    break;
                case 'status':
                    $q->orderBy('status', $dir);
                    break;
                case 'task_category_id':
                    // sort by category name
                    $q->leftJoin('task_categories as tc', 'tasks.task_category_id', '=', 'tc.id')
                        ->select('tasks.*')
                        ->orderBy('tc.name', $dir);
                    break;
                case 'user_id':
                    // sort by creator name
                    $q->leftJoin('users as u', 'tasks.user_id', '=', 'u.id')
                        ->select('tasks.*')
                        ->orderBy('u.name', $dir);
                    break;
                case 'assignee':
                    // sort by first assignee's name (user_ids[0]) using json_extract
                    // works on SQLite with JSON1; for other DBs this may need adjustment
                    $q->leftJoin('users as au', DB::raw('au.id'), '=', DB::raw("json_extract(tasks.user_ids, '$[0]')"))
                        ->select('tasks.*')
                        ->orderBy('au.name', $dir);
                    break;
                default:
                    $q->orderBy('id', 'desc');
            }
        } else {
            $q->orderBy('id', 'desc');
        }

        $tasks = $q->get();

        // enrich with assignee user basic info
        $tasks = $tasks->map(function ($t) {
            $assignees = [];
            if (!empty($t->user_ids) && is_array($t->user_ids)) {
                $assignees = User::whereIn('id', $t->user_ids)->get(['id', 'name'])->toArray();
            }
            $arr = $t->toArray();
            $arr['assignees'] = $assignees;
            $arr['category'] = $t->category ? ['id' => $t->category->id, 'name' => $t->category->name, 'color' => $t->category->color ?? null] : null;
            return $arr;
        });

        return response()->json(['tasks' => $tasks], 200);
    }

    public function show(Request $request, $id)
    {
        $t = Task::find($id);
        if (!$t) return response()->json(['message' => 'タスクが見つかりません'], 404);

        $assignees = [];
        if (!empty($t->user_ids) && is_array($t->user_ids)) {
            $assignees = User::whereIn('id', $t->user_ids)->get(['id', 'name'])->toArray();
        }

        $out = $t->toArray();
        $out['assignees'] = $assignees;
        $out['category'] = $t->category ? ['id' => $t->category->id, 'name' => $t->category->name, 'color' => $t->category->color ?? null] : null;
        return response()->json(['task' => $out], 200);
    }

    public function store(Request $request)
    {
        $baseRules = [
            'title' => 'required|string',
            'description' => 'nullable|string',
            'start_at' => 'required|date',
            'end_at' => 'nullable|date|after_or_equal:start_at',
            'is_public' => 'boolean',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'required|exists:users,id',
            'task_category_id' => 'nullable|exists:task_categories,id',
            'status' => 'nullable|in:未着手,進行中,完了,キャンセル,保留',
        ];

        $rules = array_merge($baseRules, ['id' => 'nullable|exists:tasks,id']);

        $data = $request->validate($rules);

        // Authorization
        try {
            if (!empty($data['id'])) {
                $task = Task::find($data['id']);
                if (!$task) return response()->json(['message' => '指定のタスクが見つかりません'], 404);
                Gate::forUser($request->user())->authorize('update', $task);
            } else {
                Gate::forUser($request->user())->authorize('create', Task::class);
            }
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => '権限がありません'], 403);
        }

        if (!empty($data['id'])) {
            // update
            $t = Task::find($data['id']);
            $t->title = $data['title'];
            $t->description = $data['description'] ?? null;
            $t->start_at = $data['start_at'];
            $t->end_at = $data['end_at'] ?? null;
            $t->task_category_id = $data['task_category_id'] ?? null;
            if (isset($data['status'])) $t->status = $data['status'];
            if (isset($data['is_public'])) $t->is_public = (bool)$data['is_public'];
            // keep legacy user_id untouched; use user_ids as canonical source
            if (array_key_exists('user_ids', $data)) {
                $t->user_ids = $data['user_ids'];
            }
            $t->save();
            return response()->json(['message' => 'タスクを更新しました', 'task' => $t], 200);
        }

        // create
        $creatorId = $request->user() ? $request->user()->id : null;
        $t = Task::create([
            // keep legacy column for compatibility
            'user_id' => $creatorId,
            'user_ids' => $data['user_ids'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'start_at' => $data['start_at'],
            'end_at' => $data['end_at'] ?? null,
            'task_category_id' => $data['task_category_id'] ?? null,
            'status' => $data['status'] ?? '未着手',
            'is_public' => $data['is_public'] ?? false,
        ]);

        return response()->json(['message' => 'タスクを作成しました', 'task' => $t], 201);
    }

    public function destroy(Request $request, $id)
    {
        $t = Task::find($id);
        if (!$t) return response()->json(['message' => 'タスクが見つかりません'], 404);

        try {
            Gate::forUser($request->user())->authorize('delete', $t);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => '権限がありません'], 403);
        }

        try {
            $t->delete();
            return response()->json(['message' => 'タスクを削除しました'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => '削除に失敗しました'], 500);
        }
    }
}
