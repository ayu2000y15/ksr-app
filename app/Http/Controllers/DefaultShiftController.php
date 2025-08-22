<?php

namespace App\Http\Controllers;

use App\Models\DefaultShift;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Auth;

class DefaultShiftController extends Controller
{
    public function index()
    {
        if (!Auth::user()->hasRole('システム管理者')) {
            $this->authorize('viewAny', DefaultShift::class);
        }

        $items = DefaultShift::orderBy('day_of_week')->get();
        return inertia('admin/default-shifts', ['default_shifts' => $items]);
    }

    public function create()
    {
        $this->authorize('create', DefaultShift::class);
        return inertia('admin/default-shifts/create');
    }

    public function store(Request $request)
    {
        $this->authorize('create', DefaultShift::class);
        // Support bulk creation: if 'entries' array is provided, create multiple rows (one per weekday)
        if ($request->has('entries') && is_array($request->input('entries'))) {
            $validated = $request->validate([
                'name' => 'required|string',
                'entries' => 'required|array|min:1',
                'entries.*.day_of_week' => 'required|integer|min:0|max:6',
                'entries.*.type' => 'required|in:weekday,holiday',
                'entries.*.shift_type' => 'required|in:day,night',
                'entries.*.start_time' => 'required',
                'entries.*.end_time' => 'required',
            ]);

            foreach ($validated['entries'] as $entry) {
                DefaultShift::create([
                    'name' => $validated['name'],
                    'type' => $entry['type'],
                    'day_of_week' => $entry['day_of_week'],
                    'shift_type' => $entry['shift_type'],
                    'start_time' => $entry['start_time'],
                    'end_time' => $entry['end_time'],
                ]);
            }

            return Redirect::route('admin.default-shifts.index')->with('success', 'デフォルトシフトを作成しました。');
        }

        // Backwards-compatible single-entry create
        $data = $request->validate([
            'name' => 'required|string',
            'type' => 'required|in:weekday,holiday',
            'day_of_week' => 'required|integer|min:0|max:6',
            'shift_type' => 'required|in:day,night',
            'start_time' => 'required',
            'end_time' => 'required',
        ]);

        DefaultShift::create($data);
        return Redirect::route('admin.default-shifts.index')->with('success', 'デフォルトシフトを作成しました。');
    }

    public function edit(DefaultShift $default_shift)
    {
        $this->authorize('update', $default_shift);
        return inertia('admin/default-shifts/edit', ['default_shift' => $default_shift]);
    }

    public function update(Request $request, DefaultShift $default_shift)
    {
        $this->authorize('update', $default_shift);

        $data = $request->validate([
            'name' => 'required|string',
            'type' => 'required|in:weekday,holiday',
            'day_of_week' => 'required|integer|min:0|max:6',
            'shift_type' => 'required|in:day,night',
            'start_time' => 'required',
            'end_time' => 'required',
        ]);

        $default_shift->update($data);
        return Redirect::route('admin.default-shifts.index')->with('success', 'デフォルトシフトを更新しました。');
    }

    public function destroy(DefaultShift $default_shift)
    {
        $this->authorize('delete', $default_shift);
        $default_shift->delete();
        return Redirect::route('admin.default-shifts.index')->with('success', 'デフォルトシフトを削除しました。');
    }
}
