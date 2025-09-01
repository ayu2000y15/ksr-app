<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\User;
use App\Models\TaskCategory;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TaskController
{
    public function index(Request $request)
    {
        $q = Task::query();
        // optional: if caller provided ?month=YYYY-MM-DD, restrict to tasks overlapping that month
        if ($request->has('month')) {
            try {
                $month = Carbon::parse($request->query('month'));
            } catch (\Exception $e) {
                $month = Carbon::now();
            }
            $start = $month->copy()->startOfMonth()->toDateTimeString();
            $end = $month->copy()->endOfMonth()->toDateTimeString();
            $q->where(function ($qq) use ($start, $end) {
                $qq->whereBetween('start_at', [$start, $end])
                    ->orWhereBetween('end_at', [$start, $end])
                    ->orWhere(function ($q2) use ($start, $end) {
                        $q2->where('start_at', '<=', $start)
                            ->where(function ($q3) use ($end) {
                                $q3->whereNotNull('end_at')->where('end_at', '>=', $end)
                                    ->orWhereNull('end_at');
                            });
                    });
            });
        }
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

        // enforce visibility: by default show audience='all' and owner and restricted-with-role matches.
        // If caller provided ?audience=all|restricted, constrain results to that audience while
        // still allowing owners (they always see their tasks) and, for restricted filter, allow
        // restricted tasks that match the user's roles.
        $user = $request->user();
        $userRoleIds = [];
        if ($user) {
            try {
                $userRoleIds = $user->roles()->pluck('id')->toArray();
            } catch (\Exception $e) {
                $userRoleIds = [];
            }
        }

        // Build strictness flags
        $roleParam = $request->query('role');
        $hasRoleParam = !empty($roleParam);

        $audienceParam = $request->query('audience');

        // If a role filter is provided, perform a strict role-only query (optionally intersect with audience)
        if ($hasRoleParam) {
            $q->whereHas('roles', function ($qr) use ($roleParam) {
                if (is_numeric($roleParam)) {
                    $qr->where('roles.id', intval($roleParam));
                } else {
                    $qr->where('roles.name', $roleParam);
                }
            });

            // if audience param specified, intersect with that audience strictly
            if ($audienceParam === 'all') {
                $q->where('audience', 'all');
            } elseif ($audienceParam === 'restricted') {
                // only restricted tasks that match the user's roles (if user has roles)
                if (!empty($userRoleIds)) {
                    $q->where('audience', 'restricted')
                        ->whereHas('roles', function ($qr) use ($userRoleIds) {
                            $qr->whereIn('roles.id', $userRoleIds);
                        });
                } else {
                    // user cannot see restricted tasks via role match
                    $q->whereRaw('0 = 1');
                }
            }
        } else {
            // No role filter: apply audience filtering rules. Treat audience=all/restricted strictly (no owner fallback)
            if ($audienceParam === 'all') {
                $q->where('audience', 'all');
            } elseif ($audienceParam === 'restricted') {
                if (!empty($userRoleIds)) {
                    $q->where('audience', 'restricted')
                        ->whereHas('roles', function ($qr) use ($userRoleIds) {
                            $qr->whereIn('roles.id', $userRoleIds);
                        });
                } else {
                    $q->whereRaw('0 = 1');
                }
            } else {
                // default behaviour: audience='all' OR owner OR restricted matching user's roles
                $q->where(function ($qq) use ($userRoleIds, $user) {
                    $qq->where('audience', 'all');
                    if ($user) {
                        $qq->orWhere('user_id', $user->id);
                    }
                    if (!empty($userRoleIds)) {
                        $qq->orWhere(function ($q2) use ($userRoleIds) {
                            $q2->where('audience', 'restricted')
                                ->whereHas('roles', function ($qr) use ($userRoleIds) {
                                    $qr->whereIn('roles.id', $userRoleIds);
                                });
                        });
                    }
                });
            }
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
            // include audience and roles for frontend editing
            $arr['audience'] = $t->audience ?? 'all';
            $arr['roles'] = $t->roles()->get()->map(function ($r) {
                return ['id' => $r->id, 'name' => $r->name];
            })->toArray();
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
        $out['audience'] = $t->audience ?? 'all';
        $out['roles'] = $t->roles()->get()->map(function ($r) {
            return ['id' => $r->id, 'name' => $r->name];
        })->toArray();
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
            'audience' => 'nullable|in:all,restricted',
            'roles' => 'nullable|array',
            'roles.*' => 'nullable|exists:roles,id',
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
            // audience and roles sync
            if (isset($data['audience'])) {
                $t->audience = $data['audience'];
            }
            if (isset($data['roles'])) {
                // sync pivot
                $t->roles()->sync($data['roles']);
            } elseif (isset($data['audience']) && $data['audience'] === 'restricted' && !isset($data['roles'])) {
                // if audience set to restricted but no roles provided, clear existing
                $t->roles()->sync([]);
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
            'audience' => $data['audience'] ?? 'all',
        ]);

        // attach roles if restricted
        if (!empty($data['audience']) && $data['audience'] === 'restricted' && !empty($data['roles']) && is_array($data['roles'])) {
            $t->roles()->sync($data['roles']);
        }

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
