<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class ShiftDetail extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'type', // work|break
        'start_time',
        'end_time',
        'status',
    ];

    protected $casts = [
        // Keep raw DB wall-clock strings. Avoid automatic Carbon/timezone conversions.
        'date' => 'string',
        'start_time' => 'string',
        'end_time' => 'string',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
