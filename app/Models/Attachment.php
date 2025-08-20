<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attachment extends Model
{
    protected $fillable = ['file_path', 'original_name'];

    public function attachable()
    {
        return $this->morphTo();
    }
}
