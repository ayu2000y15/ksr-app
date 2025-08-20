<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Property extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'real_estate_agent_id',
        'postal_code',
        'address',
        'has_parking',
        'layout',
        'contract_date',
        'cancellation_date',
        'room_details',
        'memo',
        'order_column',
        'key_returned',
    ];
}
