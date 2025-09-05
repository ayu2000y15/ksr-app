<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class Property extends BaseModel
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

    public function roomOccupancies()
    {
        return $this->hasMany(\App\Models\RoomOccupancy::class);
    }

    public function realEstateAgent()
    {
        return $this->belongsTo(\App\Models\RealEstateAgent::class, 'real_estate_agent_id');
    }
}
