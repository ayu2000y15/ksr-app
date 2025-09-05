<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class BaseModel extends Model
{
    use LogsActivity;

    // Record all attributes that are fillable by default
    protected static $logFillable = true;

    // Log only changed attributes for updates
    protected static $logOnlyDirty = true;

    // Don't submit empty logs
    protected static $submitEmptyLogs = false;

    // Exclude these attributes globally
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
