<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BreakTime extends Model
{
    use HasFactory;

    // テーブル名を明示的に指定
    protected $table = 'breaks';

    protected $fillable = [
        'shift_id',
        'type',
        'start_time',
        'end_time',
        'actual_start_time',
        'actual_end_time',
    ];
}
