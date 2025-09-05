<?php

namespace App\Models;

use App\Models\BaseModel;

class ShiftSetting extends BaseModel
{
    protected $fillable = [
        'apply_deadline_days',
        'default_schedule_view_start_time',
        'default_schedule_view_end_time',
        'schedule_interval_minutes',
    ];
}
