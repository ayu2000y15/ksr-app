<?php

namespace App\Models;

use App\Models\BaseModel;

class CommentRead extends BaseModel
{
    protected $fillable = ['comment_id', 'user_id', 'read_at'];
}
