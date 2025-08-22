<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class UserShiftSetting extends Model
{
    use HasFactory;

    protected $table = 'user_shift_settings';

    // table does not have created_at/updated_at
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'monthly_leave_limit',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
