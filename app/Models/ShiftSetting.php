<?php

namespace App\Models;

use App\Models\BaseModel;

class ShiftSetting extends BaseModel
{
    // shift_settings テーブルには created_at / updated_at カラムが無いため無効化
    public $timestamps = false;

    protected $fillable = [
        'apply_deadline_days',
        'default_schedule_view_start_time',
        'default_schedule_view_end_time',
        'schedule_interval_minutes',
        'shift_applications_notice',
    ];
}
