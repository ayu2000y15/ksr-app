<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poll extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_id',
        'expires_at',
        'option_type',
        'allow_multiple_votes',
        'is_anonymous',
        'description',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'allow_multiple_votes' => 'boolean',
        'is_anonymous' => 'boolean',
    ];

    public function post()
    {
        return $this->belongsTo(Post::class);
    }

    public function options()
    {
        return $this->hasMany(PollOption::class)->orderBy('order');
    }

    public function votes()
    {
        return $this->hasMany(PollVote::class);
    }
}
