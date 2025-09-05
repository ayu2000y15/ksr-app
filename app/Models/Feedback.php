<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class Feedback extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'category',
        'priority',
        'body',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
