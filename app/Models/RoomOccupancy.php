<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoomOccupancy extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_id',
        'user_id',
        'move_in_date',
        'move_out_date',
        'final_move_out_user_id',
        'checkout_user_id',
        'checkout_date',
    ];
}
