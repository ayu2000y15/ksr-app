<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class Holiday extends BaseModel
{
    use HasFactory;

    protected $fillable = ['date', 'name'];
    protected $casts = [
        'date' => 'date',
    ];
}
