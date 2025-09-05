<?php

namespace App\Models;

use App\Models\BaseModel;

class PostRead extends BaseModel
{
    protected $fillable = ['post_id', 'user_id', 'read_at'];
}
