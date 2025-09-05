<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;
use App\Models\User;

class Reaction extends BaseModel
{
    use HasFactory;

    protected $table = 'post_reactions';

    protected $fillable = ['user_id', 'emoji'];

    public function reactable()
    {
        return $this->morphTo();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
