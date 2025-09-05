<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class Comment extends BaseModel
{
    use HasFactory;

    protected $fillable = ['post_id', 'user_id', 'body'];

    public function reactions()
    {
        return $this->morphMany(Reaction::class, 'reactable');
    }
}
