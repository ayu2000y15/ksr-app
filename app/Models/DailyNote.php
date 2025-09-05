<?php

namespace App\Models;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class DailyNote extends BaseModel
{
    protected $fillable = ['date', 'user_id', 'body'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function comments()
    {
        return $this->hasMany(DailyNoteComment::class);
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'daily_note_tag');
    }
}
