<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\UserController; // UserControllerをインポート
use App\Http\Controllers\PostController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Middleware\EnsureNotRetired;
use App\Http\Middleware\EnsurePasswordChanged;
use App\Http\Controllers\Auth\RegisteredUserController;

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
    // Route::get('register', [RegisteredUserController::class, 'create'])
    //     ->name('register');

    Route::post('register', [RegisteredUserController::class, 'store']);

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // --- ユーザー管理ルート ---
    // 権限ミドルウェアは後で追加することを想定 (e.g., ->middleware('can:manage-users'))
    Route::get('/users', [UserController::class, 'index'])->name('users.index');
    Route::get('/users/create', [UserController::class, 'create'])->name('users.create');
    Route::post('/users', [UserController::class, 'store'])->name('users.store');
    // ユーザー詳細ページ（モーダルではなく別ページ）
    Route::get('/users/{user}', [UserController::class, 'show'])->name('users.show');
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
    // ユーザー統計ページ（shifts 配下のパスに移動）
    Route::get('/shifts/user-stats', [UserController::class, 'stats'])->name('shifts.user-stats');

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
    // 専用の日間タイムラインページ（クエリ or param で日付指定）
    Route::get('/shifts/daily', [App\Http\Controllers\ShiftController::class, 'daily'])->name('shifts.daily');

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
    // 中抜けをマーク/解除する（step_outフラグ）
    Route::post('/shifts/mark-step-out', [App\Http\Controllers\ShiftController::class, 'markStepOut'])->name('shifts.mark_step_out');
    Route::post('/shifts/unmark-step-out', [App\Http\Controllers\ShiftController::class, 'unmarkStepOut'])->name('shifts.unmark_step_out');
    // 食券不要をマーク/解除
    Route::post('/shifts/mark-meal-ticket', [App\Http\Controllers\ShiftController::class, 'markMealTicket'])->name('shifts.mark_meal_ticket');
    Route::post('/shifts/unmark-meal-ticket', [App\Http\Controllers\ShiftController::class, 'unmarkMealTicket'])->name('shifts.unmark_meal_ticket');

    // Toggle confirm/unconfirm for all scheduled work ShiftDetails on a date
    Route::post('/shifts/toggle-confirm-date', [App\Http\Controllers\ShiftController::class, 'toggleConfirmDate'])->name('shifts.toggle_confirm_date');

    // Apply preferred weekly holidays for a month: create 'leave' shifts on users' preferred_week_days
    Route::post('/shifts/apply-preferred-holidays', [App\Http\Controllers\ShiftController::class, 'applyPreferredHolidays'])->name('shifts.apply_preferred_holidays');

    // ShiftDetail 単体更新（開始/終了時刻の編集）
    Route::patch('/shift-details/{shift_detail}', [App\Http\Controllers\ShiftDetailController::class, 'update'])->name('shift-details.update');
    // ShiftDetail 作成（休憩などの勤務詳細を追加）
    Route::post('/shift-details', [App\Http\Controllers\ShiftDetailController::class, 'store'])->name('shift-details.store');
    // ShiftDetail 削除（勤務詳細の削除）
    Route::delete('/shift-details/{shift_detail}', [App\Http\Controllers\ShiftDetailController::class, 'destroy'])->name('shift-details.destroy');

    // Lightweight JSON API to fetch shiftDetails for a date (used by frontend optimistic replacement)
    Route::get('/shift-details/api', [App\Http\Controllers\ShiftDetailController::class, 'apiIndex'])->name('shift-details.api');

    // --- 休暇申請（シフト申請） ---
    Route::resource('shift-applications', App\Http\Controllers\ShiftApplicationController::class)->only([
        'index',
        'create',
        'store',
        'show',
        'update',
        'destroy'
    ]);

    // --- 掲示板（Inertia pages） ---
    Route::inertia('/posts', 'posts/index')->name('posts.index');
    Route::inertia('/posts/create', 'posts/create')->name('posts.create');
    // タスク・予定（Inertia page）
    Route::inertia('/tasks', 'tasks/index')->name('tasks.index');
    // タスク カレンダー表示 (コントローラ経由で祝日を渡す)
    Route::get('/tasks/calendar', [\App\Http\Controllers\TaskCalendarController::class, 'index'])->name('tasks.calendar');
    // タスクカテゴリ管理（在庫カテゴリと同様の画面構成）
    Route::prefix('tasks')->name('tasks.')->group(function () {
        Route::get('categories', [\App\Http\Controllers\TaskCategoryPageController::class, 'index'])->name('categories.index');
        Route::get('categories/create', [\App\Http\Controllers\TaskCategoryPageController::class, 'create'])->name('categories.create');
        Route::post('categories', [\App\Http\Controllers\TaskCategoryPageController::class, 'store'])->name('categories.store');
        Route::get('categories/{category}/edit', [\App\Http\Controllers\TaskCategoryPageController::class, 'edit'])->name('categories.edit');
        Route::patch('categories/{category}', [\App\Http\Controllers\TaskCategoryPageController::class, 'update'])->name('categories.update');
        Route::delete('categories/{category}', [\App\Http\Controllers\TaskCategoryPageController::class, 'destroy'])->name('categories.destroy');
        Route::post('categories/reorder', [\App\Http\Controllers\TaskCategoryPageController::class, 'reorder'])->name('categories.reorder');
    });
    // Use controller for show so we can pass the post as an Inertia prop
    Route::get('/posts/{post}', [PostController::class, 'showPage'])->name('posts.show');
    Route::get('/posts/{post}/edit', [PostController::class, 'editPage'])->name('posts.edit');

    // 在庫管理（Inertia pages）
    Route::get('/inventory', [\App\Http\Controllers\InventoryPageController::class, 'index'])->name('inventory.index');
    Route::get('/inventory/create', [\App\Http\Controllers\InventoryPageController::class, 'create'])->name('inventory.create');
    // 物件管理（入退寮ガント表示）
    Route::get('/properties', [\App\Http\Controllers\PropertyPageController::class, 'index'])->name('properties.index');
    // 物件マスタ管理トップ
    Route::get('/properties/admin', [\App\Http\Controllers\PropertyAdminController::class, 'index'])->name('properties.admin');
    // explicit named route for masters properties index (Ziggy-safe)
    Route::get('/properties/masters/properties', [\App\Http\Controllers\PropertyAdminController::class, 'index'])->name('properties.masters.properties.index');
    // マスタ: 物件 / 不動産会社 / 家具
    Route::prefix('properties')->name('properties.')->group(function () {
        Route::resource('masters/real-estate-agents', \App\Http\Controllers\RealEstateAgentController::class)->only(['index', 'create', 'store', 'edit', 'update', 'destroy']);
        Route::resource('masters/furniture-masters', \App\Http\Controllers\FurnitureMasterController::class)->only(['index', 'create', 'store', 'edit', 'update', 'destroy']);
        Route::resource('masters/properties', \App\Http\Controllers\PropertyAdminController::class)->only(['index', 'create', 'store', 'edit', 'update', 'destroy']);
        // reorder endpoints for drag-and-drop ordering
        Route::post('masters/real-estate-agents/reorder', [\App\Http\Controllers\RealEstateAgentController::class, 'reorder'])->name('properties.masters.real-estate-agents.reorder');
        Route::post('masters/furniture-masters/reorder', [\App\Http\Controllers\FurnitureMasterController::class, 'reorder'])->name('properties.masters.furniture-masters.reorder');
        Route::post('masters/properties/reorder', [\App\Http\Controllers\PropertyAdminController::class, 'reorder'])->name('properties.masters.properties.reorder');

        // Accept POST for update to support clients that send POST instead of PATCH
        Route::post('masters/real-estate-agents/{real_estate_agent}', [\App\Http\Controllers\RealEstateAgentController::class, 'update'])->name('properties.masters.real-estate-agents.update.post');
        Route::post('masters/furniture-masters/{furniture_master}', [\App\Http\Controllers\FurnitureMasterController::class, 'update'])->name('properties.masters.furniture-masters.update.post');
        Route::post('masters/properties/{property}', [\App\Http\Controllers\PropertyAdminController::class, 'update'])->name('properties.masters.properties.update.post');
        // property furniture (物件の家具) create endpoint used by the admin UI when editing a property
        Route::post('masters/property-furniture', [\App\Http\Controllers\PropertyFurnitureController::class, 'store'])->name('properties.masters.property-furniture.store');
        // update existing property furniture row (POST to support clients that post)
        Route::post('masters/property-furniture/{property_furniture}', [\App\Http\Controllers\PropertyFurnitureController::class, 'update'])->name('properties.masters.property-furniture.update.post');
        // delete property furniture row
        Route::delete('masters/property-furniture/{property_furniture}', [\App\Http\Controllers\PropertyFurnitureController::class, 'destroy'])->name('properties.masters.property-furniture.destroy');
    });
    // 在庫カテゴリ管理 (一覧・作成・更新・削除) — 名前空間を inventory.* に揃える
    Route::prefix('inventory')->name('inventory.')->group(function () {
        Route::resource('categories', \App\Http\Controllers\InventoryCategoryController::class)->except(['show']);
        // reorder categories by drag-and-drop (expects { order: [id,...] })
        Route::post('categories/reorder', [\App\Http\Controllers\InventoryCategoryController::class, 'reorder'])->name('categories.reorder');
        // Damage conditions administration (破損状態)
        Route::resource('damage-conditions', \App\Http\Controllers\DamageConditionController::class)->except(['show']);
        // reorder damage conditions
        Route::post('damage-conditions/reorder', [\App\Http\Controllers\DamageConditionController::class, 'reorder'])->name('damage-conditions.reorder');
        // inventory stock logs (change history)
        Route::get('stock-logs', [\App\Http\Controllers\InventoryStockLogController::class, 'index'])->name('stock_logs.index');
        // damaged inventory page
        Route::inertia('damaged', 'inventory/damaged/index')->name('damaged');
    });

    // --- 管理: 休日登録 ---
    Route::inertia('/admin/holidays', 'admin/holidays')->name('admin.holidays');
});

require __DIR__ . '/auth.php';
