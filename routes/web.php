<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\UserController; // UserControllerをインポート
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Middleware\EnsureNotRetired;

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



Route::middleware(['auth', EnsureNotRetired::class])->group(function () {
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
});

require __DIR__ . '/auth.php';
