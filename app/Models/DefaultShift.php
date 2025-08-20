<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DefaultShift extends Model
{
    protected $fillable = [
        'name',
        'type',
        'day_of_week',
        'shift_type',
        'start_time',
        'end_time',
    ];
}
