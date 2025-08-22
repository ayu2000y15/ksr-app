<?php

namespace App\Http\Controllers;

use App\Models\UserShiftSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class UserShiftSettingController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', UserShiftSetting::class);
        // get all users and existing settings keyed by user_id
        $users = User::orderBy('name')->get();
        $settings = UserShiftSetting::whereIn('user_id', $users->pluck('id'))->get()->keyBy('user_id');
        return inertia('admin/user-shift-settings', ['users' => $users, 'settings' => $settings]);
    }

    // create page no longer used; handled inline on index

    public function store(Request $request)
    {
        $this->authorize('create', UserShiftSetting::class);
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'monthly_leave_limit' => 'required|integer|min:0|max:31',
        ]);

        // If a setting for this user already exists, update it instead of creating (unique constraint)
        $existing = UserShiftSetting::where('user_id', $data['user_id'])->first();
        if ($existing) {
            $existing->update(['monthly_leave_limit' => $data['monthly_leave_limit']]);
            if ($request->wantsJson()) {
                return response()->json($existing);
            }
            return Redirect::route('admin.user-shift-settings.index')->with('success', 'ユーザー休暇上限を更新しました。');
        }

        $created = UserShiftSetting::create($data);
        if ($request->wantsJson()) {
            return response()->json($created);
        }
        return Redirect::route('admin.user-shift-settings.index')->with('success', 'ユーザー休暇上限を作成しました。');
    }

    public function edit(UserShiftSetting $user_shift_setting)
    {
        $this->authorize('update', $user_shift_setting);
        $users = User::orderBy('name')->get();
        return inertia('admin/user-shift-settings/edit', ['item' => $user_shift_setting, 'users' => $users]);
    }

    public function update(Request $request, UserShiftSetting $user_shift_setting)
    {
        $this->authorize('update', $user_shift_setting);
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'monthly_leave_limit' => 'required|integer|min:0|max:31',
        ]);

        $user_shift_setting->update($data);
        return Redirect::route('admin.user-shift-settings.index')->with('success', 'ユーザー休暇上限を更新しました。');
    }

    public function destroy(UserShiftSetting $user_shift_setting)
    {
        $this->authorize('delete', $user_shift_setting);
        $user_shift_setting->delete();
        return Redirect::route('admin.user-shift-settings.index')->with('success', '削除しました。');
    }
}
