<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class Supplier extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'name',
        'contact_person',
        'phone_number',
        'address',
        'order_column',
    ];
}
