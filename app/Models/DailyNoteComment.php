<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyNoteComment extends Model
{
    protected $table = 'daily_note_comments';
    protected $fillable = ['daily_note_id', 'user_id', 'body', 'quote_comment_id'];

    public function dailyNote(): BelongsTo
    {
        return $this->belongsTo(DailyNote::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function quote()
    {
        return $this->belongsTo(DailyNoteComment::class, 'quote_comment_id');
    }
}
