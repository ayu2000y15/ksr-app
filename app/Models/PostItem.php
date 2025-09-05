<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class PostItem extends BaseModel
{
    use HasFactory;

    protected $fillable = ['post_id', 'order', 'content'];

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
