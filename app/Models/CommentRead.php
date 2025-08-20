<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommentRead extends Model
{
    protected $fillable = ['comment_id', 'user_id', 'read_at'];
}
