<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'shift_type',
        'step_out',
        'meal_ticket',
    ];

    protected $casts = [
        'date' => 'date',
        'step_out' => 'integer',
        'meal_ticket' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
