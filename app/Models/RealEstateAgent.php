<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class RealEstateAgent extends BaseModel
{
    use HasFactory;

    protected $fillable = ['name', 'order_column'];
    public $timestamps = false;
}
