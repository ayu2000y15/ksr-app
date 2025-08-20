<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PostRead extends Model
{
    protected $fillable = ['post_id', 'user_id', 'read_at'];
}
