<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        // legacy single owner column kept for compatibility; prefer user_ids for assignment
        'user_id',
        'user_ids',
        'task_category_id',
        'status',
        'title',
        'description',
        'start_at',
        'end_at',
        'is_public',
    ];

    protected $casts = [
        'user_ids' => 'array',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'is_public' => 'boolean',
    ];

    public function category()
    {
        return $this->belongsTo(TaskCategory::class, 'task_category_id');
    }

    public function assignees()
    {
        return $this->belongsToMany(User::class, 'task_assignees');
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
