<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'type', 'title', 'body', 'is_public', 'audience'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function postItems()
    {
        return $this->hasMany(PostItem::class)->orderBy('order');
    }

    public function reactions()
    {
        return $this->morphMany(Reaction::class, 'reactable');
    }

    public function views()
    {
        return $this->morphMany(PostView::class, 'viewable');
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class);
    }

    public function roles()
    {
        return $this->belongsToMany(\Spatie\Permission\Models\Role::class, 'post_role');
    }

    public function allowedUsers()
    {
        return $this->belongsToMany(\App\Models\User::class, 'post_user');
    }

    /**
     * Users who have pinned this post
     */
    public function pinnedByUsers()
    {
        return $this->belongsToMany(\App\Models\User::class, 'post_user_pins')->withTimestamps();
    }
}
