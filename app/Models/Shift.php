<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'date', 'start_time', 'end_time'];

    public function breaks()
    {
        return $this->hasMany(BreakTime::class); // Breakは予約語のためBreakTimeとします
    }
}
