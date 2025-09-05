<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class TaskCategory extends BaseModel
{
    use HasFactory;

    protected $fillable = ['name', 'order_column', 'color'];
}
