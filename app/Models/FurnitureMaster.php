<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class FurnitureMaster extends BaseModel
{
    use HasFactory;

    protected $fillable = ['name', 'order_column'];
    public $timestamps = false;
}
