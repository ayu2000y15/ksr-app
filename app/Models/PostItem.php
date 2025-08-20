<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PostItem extends Model
{
    use HasFactory;

    protected $fillable = ['post_id', 'order', 'content'];

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
