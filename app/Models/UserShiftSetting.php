<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserShiftSetting extends Model
{
    protected $fillable = ['user_id', 'monthly_leave_limit'];
}
