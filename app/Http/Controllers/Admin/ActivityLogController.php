<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Spatie\Activitylog\Models\Activity;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('activitylog.view');

        $perPage = (int) $request->query('per_page', 25);
        $page = (int) $request->query('page', 1);

        $query = Activity::with('causer')
            ->orderBy('created_at', 'desc');

        // If the request expects JSON (ajax/load-more) and is NOT an Inertia navigation, return a paginated JSON payload
        // Inertia sends an X-Inertia header; if present we must return an Inertia response instead of plain JSON.
        if (($request->wantsJson() || $request->ajax()) && ! $request->header('X-Inertia')) {
            $p = $query->paginate($perPage, ['*'], 'page', $page);
            return response()->json([
                'activities' => $p->items(),
                'meta' => [
                    'current_page' => $p->currentPage(),
                    'last_page' => $p->lastPage(),
                    'per_page' => $p->perPage(),
                    'total' => $p->total(),
                ],
            ]);
        }

        // Otherwise render full Inertia page with default pagination for initial load
        $activities = $query->paginate($perPage);
        return inertia('admin/activity-logs/index', [
            'activities' => $activities,
        ]);
    }
}
