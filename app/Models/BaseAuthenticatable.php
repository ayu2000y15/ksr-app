<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class BaseAuthenticatable extends Authenticatable
{
    use LogsActivity;

    protected static $ignoreChangedAttributes = ['password', 'remember_token'];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->logExcept($this->getIgnoredAttributes() ?? []);
    }

    protected function getIgnoredAttributes(): array
    {
        return static::$ignoreChangedAttributes ?? [];
    }
}
