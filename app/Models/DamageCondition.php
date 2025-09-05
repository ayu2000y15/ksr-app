<?php

namespace App\Models;

use App\Models\BaseModel;

class DamageCondition extends BaseModel
{
    protected $fillable = ['condition', 'order_column'];
    public $timestamps = false;
}
