<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
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

        return Inertia::render('tasks/calendar', [
            'month' => $month->toDateString(),
            'holidays' => $holidays,
        ]);
    }
}
