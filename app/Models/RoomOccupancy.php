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
        'user_ids',
        'move_in_date',
        'move_out_date',
        'final_move_out_user_id',
        'checkout_user_id',
        'checkout_date',
    ];

    protected $casts = [
        'user_ids' => 'array',
    ];

    public function property()
    {
        return $this->belongsTo(\App\Models\Property::class);
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    /**
     * The user who confirmed checkout (退去確認者)
     */
    public function checkoutUser()
    {
        return $this->belongsTo(\App\Models\User::class, 'checkout_user_id');
    }

    /**
     * The user who was the final move-out actor (最終退寮者)
     */
    public function finalMoveOutUser()
    {
        return $this->belongsTo(\App\Models\User::class, 'final_move_out_user_id');
    }
}
