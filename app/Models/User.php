<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'temporary_password',
        'phone_number',
        'line_name',
        'gender',
        'has_car',
        'status',
        'memo',
        'must_change_password',
        'employment_condition',
        'commute_method',
        'default_start_time',
        'default_end_time',
        'preferred_week_days',
        'employment_period',
        'employment_notes',
        'preferred_week_days_count',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'temporary_password_expires_at' => 'datetime',
        'must_change_password' => 'boolean',
        'has_car' => 'boolean',
        'preferred_week_days' => 'array',
        'preferred_week_days_count' => 'int',
    ];


    /**
     * Send the password reset notification using our custom notification (Japanese subject/body).
     */
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new \App\Notifications\ResetPasswordNotification($token));
    }
}
