<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FurnitureMaster extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'order_column'];
    public $timestamps = false;
}
