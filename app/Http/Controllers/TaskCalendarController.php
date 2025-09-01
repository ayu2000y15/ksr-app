<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class TaskCalendarController extends Controller
{
    public function index(Request $request)
    {
        // determine month to display (optional ?month=YYYY-MM-DD)
        $month = $request->get('month') ? Carbon::parse($request->get('month')) : Carbon::now();

        // fetch holidays for the month: return array of {date: 'YYYY-MM-DD', name: '...'}
        $holidays = Holiday::whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->get(['date', 'name'])
            ->map(function ($h) {
                return [
                    'date' => Carbon::parse($h->date)->toDateString(),
                    'name' => $h->name ?? '',
                ];
            })->toArray();

        // fetch tasks that overlap the shown month and apply visibility rules
        $start = $month->copy()->startOfMonth()->toDateTimeString();
        $end = $month->copy()->endOfMonth()->toDateTimeString();

        $q = Task::query();
        // overlapping the month: start between or end between, or spanning the month
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

        // enforce visibility: same semantics as TaskController, but accept optional ?audience param
        $user = $request->user();
        $userRoleIds = [];
        if ($user) {
            try {
                $userRoleIds = $user->roles()->pluck('id')->toArray();
            } catch (\Exception $e) {
                $userRoleIds = [];
            }
        }

        $roleParam = $request->query('role');
        $hasRoleParam = !empty($roleParam);

        $audienceParam = $request->query('audience');

        if ($hasRoleParam) {
            $q->whereHas('roles', function ($qr) use ($roleParam) {
                if (is_numeric($roleParam)) {
                    $qr->where('roles.id', intval($roleParam));
                } else {
                    $qr->where('roles.name', $roleParam);
                }
            });

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
            }
        } else {
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

        $tasks = $q->get()->map(function ($t) {
            $assignees = [];
            if (!empty($t->user_ids) && is_array($t->user_ids)) {
                $assignees = User::whereIn('id', $t->user_ids)->get(['id', 'name'])->toArray();
            }
            $arr = $t->toArray();
            $arr['assignees'] = $assignees;
            $arr['category'] = $t->category ? ['id' => $t->category->id, 'name' => $t->category->name, 'color' => $t->category->color ?? null] : null;
            $arr['audience'] = $t->audience ?? 'all';
            $arr['roles'] = $t->roles()->get()->map(function ($r) {
                return ['id' => $r->id, 'name' => $r->name];
            })->toArray();
            return $arr;
        })->toArray();

        return Inertia::render('tasks/calendar', [
            'month' => $month->toDateString(),
            'holidays' => $holidays,
            'tasks' => $tasks,
        ]);
    }
}
