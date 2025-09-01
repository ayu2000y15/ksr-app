<?php

namespace App\Http\Middleware;

use Spatie\Permission\Models\Permission;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => function () use ($request) {
                $user = $request->user();

                if (!$user) {
                    return null;
                }

                // ユーザーが「システム管理者」ロールを持っているか確認
                $isSuperAdmin = $user->roles()->where('name', 'システム管理者')->exists();

                return [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                    ],
                    // Whether the user is a system administrator (frontend can bypass checks)
                    'isSuperAdmin' => $isSuperAdmin,
                    // システム管理者なら全ての権限を、そうでなければそのユーザーが持つ権限を渡す
                    'permissions' => $isSuperAdmin
                        ? Permission::pluck('name')->toArray() // 全ての権限名を取得
                        : $user->getAllPermissions()->pluck('name'), // ユーザーが持つ権限を取得
                ];
            },
            'ziggy' => fn(): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            // シフト申請の未来日表示制限（日数）をフロントに共有
            'shift' => function () {
                return [
                    'application_deadline_days' => config('shift.application_deadline_days', 0),
                ];
            },
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
