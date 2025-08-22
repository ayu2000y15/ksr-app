<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;

class EnsurePasswordChanged
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::user();

        if ($user && isset($user->must_change_password) && $user->must_change_password) {
            $route = $request->route();
            $routeName = $route ? $route->getName() : null;

            // 許可するルート名（パスワード変更ページとログアウト）
            $allowed = [
                'password.change',
                'password.change.store',
                'logout',
            ];

            if (! in_array($routeName, $allowed, true)) {
                if ($request->wantsJson()) {
                    return response()->json(['error' => '初回ログイン時にパスワード変更が必要です。'], 403);
                }

                return Redirect::route('password.change');
            }
        }

        return $next($request);
    }
}
