<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnnouncementRead extends Model
{
    protected $table = 'announcement_reads';
    protected $fillable = ['announcement_id', 'user_id', 'read_at'];
    public $timestamps = true;

    public function announcement()
    {
        return $this->belongsTo(Announcement::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
