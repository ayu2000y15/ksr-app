<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;

class EnsureNotRetired
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::user();

        if ($user && isset($user->status) && $user->status === 'retired') {
            // 現在ログイン中の退職ユーザーは強制ログアウトしてトップへリダイレクト
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return Redirect::route('login')->with('error', 'すでに退職しているためログインできません。');
        }

        return $next($request);
    }
}
