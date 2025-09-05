<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;
use App\Models\User;

class DailyReport extends BaseModel
{
    use HasFactory;

    protected $table = 'daily_reports';

    protected $fillable = [
        'user_id',
        'title',
        'date',
        'body',
        'is_public',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'daily_report_tag');
    }
}
