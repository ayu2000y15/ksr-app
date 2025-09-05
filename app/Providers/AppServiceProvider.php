<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Models\Activity;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Event;
use Spatie\Permission\Models\Permission;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Note: auth.permissions is now shared from the SharePermissions middleware

        // Also share whether the current user is a system administrator so the frontend
        // can bypass permission checks reliably (some shares may override nested auth objects).
        Inertia::share('auth.isSuperAdmin', function () {
            $user = Auth::user();
            if (! $user) {
                return false;
            }

            $isSuper = DB::table('roles')
                ->join('role_user', 'roles.id', '=', 'role_user.role_id')
                ->where('role_user.user_id', $user->id)
                ->where('roles.name', 'システム管理者')
                ->exists();

            return $isSuper;
        });

        // Push X-Robots-Tag middleware to the global middleware stack at runtime
        try {
            $kernel = $this->app->make(\Illuminate\Contracts\Http\Kernel::class);
            $kernel->pushMiddleware(\App\Http\Middleware\XRobotsNoIndex::class);
        } catch (\Throwable $e) {
            // If pushing middleware fails (rare), silently ignore so app can still boot.
        }

        // Global activity logger using Spatie activitylog: record create/update/delete for all Eloquent models
        try {
            // created: record full new attributes
            Model::created(function ($model) {
                if ($model instanceof Activity) {
                    return;
                }

                activity()
                    ->causedBy(Auth::user())
                    ->performedOn($model)
                    ->withProperties(['attributes' => self::filterAttributes($model->getAttributes())])
                    ->log('created');
            });

            // updating: record only changed attributes (before and after)
            Model::updating(function ($model) {
                if ($model instanceof Activity) {
                    return;
                }

                $dirty = $model->getDirty();
                if (empty($dirty)) {
                    return;
                }

                $original = $model->getOriginal();
                $old = [];
                $new = [];
                foreach ($dirty as $key => $value) {
                    if (in_array($key, ['password', 'remember_token'])) {
                        continue;
                    }
                    $old[$key] = array_key_exists($key, $original) ? $original[$key] : null;
                    $new[$key] = $model->{$key};
                }

                if (empty($old) && empty($new)) {
                    return;
                }

                activity()
                    ->causedBy(Auth::user())
                    ->performedOn($model)
                    ->withProperties(['old' => self::filterAttributes($old), 'attributes' => self::filterAttributes($new)])
                    ->log('updated');
            });

            // deleted: record attributes before deletion
            Model::deleted(function ($model) {
                if ($model instanceof Activity) {
                    return;
                }

                activity()
                    ->causedBy(Auth::user())
                    ->performedOn($model)
                    ->withProperties(['attributes' => self::filterAttributes($model->getAttributes())])
                    ->log('deleted');
            });
        } catch (\Throwable $e) {
            // Do not break application boot if logging fails for any reason.
        }

        // Record login / logout events into activity log
        try {
            Event::listen(Login::class, function (Login $event) {
                $user = $event->user ?? null;
                if (! $user) {
                    return;
                }

                activity()
                    ->causedBy($user)
                    ->withProperties([
                        'ip' => request()->ip(),
                        'user_agent' => request()->userAgent(),
                    ])
                    ->log('login');
            });

            Event::listen(Logout::class, function (Logout $event) {
                $user = $event->user ?? null;
                if (! $user) {
                    return;
                }

                activity()
                    ->causedBy($user)
                    ->withProperties([
                        'ip' => request()->ip(),
                        'user_agent' => request()->userAgent(),
                    ])
                    ->log('logout');
            });
        } catch (\Throwable $e) {
            // non-fatal
        }
    }

    /**
     * Basic attribute filtering to avoid storing sensitive data.
     */
    protected static function filterAttributes(array $attrs): array
    {
        $exclude = ['password', 'remember_token'];
        foreach ($exclude as $key) {
            if (array_key_exists($key, $attrs)) {
                unset($attrs[$key]);
            }
        }
        return $attrs;
    }
}
