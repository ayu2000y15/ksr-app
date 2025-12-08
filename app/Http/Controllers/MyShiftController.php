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
            ->get()
            ->map(function ($shift) use ($user) {
                $shiftArray = $shift->toArray();
                // Get work shift details for this user and date
                $dateStr = Carbon::parse($shift->date)->toDateString();
                $workDetails = \App\Models\ShiftDetail::where('user_id', $user->id)
                    ->whereRaw('date(date) = ?', [$dateStr])
                    ->where('type', 'work')
                    ->orderBy('start_time')
                    ->get();

                if ($workDetails->isNotEmpty()) {
                    $firstDetail = $workDetails->first();
                    $lastDetail = $workDetails->last();
                    $shiftArray['work_start_time'] = $firstDetail->start_time ? Carbon::parse($firstDetail->start_time)->format('H:i') : null;
                    $shiftArray['work_end_time'] = $lastDetail->end_time ? Carbon::parse($lastDetail->end_time)->format('H:i') : null;
                }
                return $shiftArray;
            });

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
