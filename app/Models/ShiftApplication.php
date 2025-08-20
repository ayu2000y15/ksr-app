<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShiftApplication extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'date', 'status', 'reason'];
}
