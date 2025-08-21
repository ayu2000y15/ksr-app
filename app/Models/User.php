<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'temporary_password',
        'phone_number',
        'line_name',
        'status',
        'memo',
        'must_change_password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'temporary_password_expires_at' => 'datetime',
            'must_change_password' => 'boolean',
        ];
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }

    /**
     * Send the password reset notification using our custom notification (Japanese subject/body).
     */
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new \App\Notifications\ResetPasswordNotification($token));
    }
}
