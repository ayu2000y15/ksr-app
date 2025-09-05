<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class DefaultShift extends BaseModel
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'name',
        'type',
        'day_of_week',
        'shift_type',
        'start_time',
        'end_time',
    ];
}
