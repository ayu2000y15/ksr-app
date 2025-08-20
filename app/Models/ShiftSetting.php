<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShiftSetting extends Model
{
    protected $fillable = [
        'apply_deadline_days',
        'default_schedule_view_start_time',
        'default_schedule_view_end_time',
        'schedule_interval_minutes',
    ];
}
