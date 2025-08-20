<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PropertyFurniture extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_id',
        'furniture_master_id',
        'quantity',
        'removal_start_date',
        'removal_date',
    ];
}
