<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\UserController; // UserControllerをインポート
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Middleware\EnsureNotRetired;
use App\Http\Middleware\EnsurePasswordChanged;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

// ルートURLにアクセスされたら、ログイン画面にリダイレクト
Route::get('/', function () {
    return redirect()->route('login');
});

Route::get('/dashboard', function () {
    return Inertia::render('dashboard'); // ファイル名を小文字に
})->middleware(['auth', 'verified'])->name('dashboard');



Route::middleware(['auth', EnsureNotRetired::class, EnsurePasswordChanged::class])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // --- ユーザー管理ルート ---
    // 権限ミドルウェアは後で追加することを想定 (e.g., ->middleware('can:manage-users'))
    Route::get('/users', [UserController::class, 'index'])->name('users.index');
    Route::get('/users/create', [UserController::class, 'create'])->name('users.create');
    Route::post('/users', [UserController::class, 'store'])->name('users.store');
    // 作成後に表示する認証情報ページ
    Route::get('/users/credentials', [UserController::class, 'credentials'])->name('users.credentials');
    // POST route for sending temporary credentials via email (used by frontend fetch)
    Route::post('/users/{user}/credentials/send', [UserController::class, 'sendCredentials'])->name('users.credentials.send');
    // Allow sending credentials by email when the page does not have a user id (credentials page)
    Route::post('/users/credentials/send', [UserController::class, 'sendCredentialsByEmail'])->name('users.credentials.send.by_email');
    // Regenerate temporary password for a user (AJAX)
    Route::post('/users/{user}/credentials/regenerate', [UserController::class, 'regenerateTemporaryPassword'])->name('users.credentials.regenerate');
    // 編集・更新・削除のルートを追加
    Route::get('/users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
    Route::patch('/users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

    // --- 管理画面（Inertiaページ） ---
    Route::inertia('/admin/roles', 'admin/roles')->name('admin.roles');
    Route::inertia('/admin/roles/create', 'admin/roles/create')->name('admin.roles.create');
    Route::inertia('/admin/roles/{role}/edit', 'admin/roles/[id]/edit')->name('admin.roles.edit');
    Route::inertia('/admin/role-permissions', 'admin/role-permissions')->name('admin.role-permissions');
    Route::inertia('/admin/user-roles', 'admin/user-roles')->name('admin.user-roles');

    // --- 管理: デフォルトシフト設定 ---
    Route::get('/admin/default-shifts', [App\Http\Controllers\DefaultShiftController::class, 'index'])->name('admin.default-shifts.index');
    Route::get('/admin/default-shifts/create', [App\Http\Controllers\DefaultShiftController::class, 'create'])->name('admin.default-shifts.create');
    Route::post('/admin/default-shifts', [App\Http\Controllers\DefaultShiftController::class, 'store'])->name('admin.default-shifts.store');
    Route::get('/admin/default-shifts/{default_shift}/edit', [App\Http\Controllers\DefaultShiftController::class, 'edit'])->name('admin.default-shifts.edit');
    Route::patch('/admin/default-shifts/{default_shift}', [App\Http\Controllers\DefaultShiftController::class, 'update'])->name('admin.default-shifts.update');
    Route::delete('/admin/default-shifts/{default_shift}', [App\Http\Controllers\DefaultShiftController::class, 'destroy'])->name('admin.default-shifts.destroy');

    // --- 管理: ユーザー別休暇上限設定 ---
    Route::get('/admin/user-shift-settings', [App\Http\Controllers\UserShiftSettingController::class, 'index'])->name('admin.user-shift-settings.index');
    Route::get('/admin/user-shift-settings/create', [App\Http\Controllers\UserShiftSettingController::class, 'create'])->name('admin.user-shift-settings.create');
    Route::post('/admin/user-shift-settings', [App\Http\Controllers\UserShiftSettingController::class, 'store'])->name('admin.user-shift-settings.store');
    Route::get('/admin/user-shift-settings/{user_shift_setting}/edit', [App\Http\Controllers\UserShiftSettingController::class, 'edit'])->name('admin.user-shift-settings.edit');
    Route::patch('/admin/user-shift-settings/{user_shift_setting}', [App\Http\Controllers\UserShiftSettingController::class, 'update'])->name('admin.user-shift-settings.update');
    Route::delete('/admin/user-shift-settings/{user_shift_setting}', [App\Http\Controllers\UserShiftSettingController::class, 'destroy'])->name('admin.user-shift-settings.destroy');

    // --- シフト管理 ---
    Route::resource('shifts', App\Http\Controllers\ShiftController::class)->only([
        'index',
        'create',
        'store',
        'show',
        'edit',
        'update',
        'destroy'
    ]);

    // バルク更新エンドポイント（カレンダーからまとめて更新する用）
    Route::post('/shifts/bulk-update', [App\Http\Controllers\ShiftController::class, 'bulkUpdate'])->name('shifts.bulk_update');
    // 即時休にする（Shift + ShiftDetail(type=break) を作る）
    Route::post('/shifts/mark-break', [App\Http\Controllers\ShiftController::class, 'markBreak'])->name('shifts.mark_break');
    // 既に休がある日を解除する（休のキャンセル）
    Route::post('/shifts/unmark-break', [App\Http\Controllers\ShiftController::class, 'unmarkBreak'])->name('shifts.unmark_break');

    // ShiftDetail 単体更新（開始/終了時刻の編集）
    Route::patch('/shift-details/{shift_detail}', [App\Http\Controllers\ShiftDetailController::class, 'update'])->name('shift-details.update');
    // ShiftDetail 削除（勤務詳細の削除）
    Route::delete('/shift-details/{shift_detail}', [App\Http\Controllers\ShiftDetailController::class, 'destroy'])->name('shift-details.destroy');

    // --- 休暇申請（シフト申請） ---
    Route::resource('shift-applications', App\Http\Controllers\ShiftApplicationController::class)->only([
        'index',
        'create',
        'store',
        'show',
        'update',
        'destroy'
    ]);
});

require __DIR__ . '/auth.php';
