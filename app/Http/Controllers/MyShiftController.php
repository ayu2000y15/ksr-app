<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\Shift;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class MyShiftController extends Controller
{
    public function index(Request $request)
    {
        // Get the month parameter, default to current month
        $month = $request->get('month') ? Carbon::parse($request->get('month')) : Carbon::now();

        // Get current user
        $user = Auth::user();

        if (!$user) {
            return redirect()->route('login');
        }

        // Get all published shifts for the current user in the specified month
        $shifts = Shift::where('user_id', $user->id)
            ->where('is_published', true)
            ->whereBetween('date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
            ->orderBy('date', 'asc')
            ->get();

        // Get holidays for the month
        $start = $month->copy()->startOfMonth();
        $end = $month->copy()->endOfMonth();

        $holidays = Holiday::whereBetween('date', [$start, $end])
            ->get(['date', 'name'])
            ->map(function ($h) {
                return [
                    'date' => Carbon::parse($h->date)->toDateString(),
                    'name' => $h->name ?? '',
                ];
            })->toArray();

        // Get published dates (dates where any user has a published shift)
        $publishedDates = Shift::where('is_published', true)
            ->whereBetween('date', [$start, $end])
            ->distinct()
            ->pluck('date')
            ->map(function ($date) {
                return Carbon::parse($date)->toDateString();
            })->toArray();

        return Inertia::render('my-shifts/index', [
            'shifts' => $shifts,
            'month' => $month->format('Y-m-d'),
            'holidays' => $holidays,
            'publishedDates' => $publishedDates,
        ]);
    }
}
