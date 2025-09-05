<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel;

class ShiftApplication extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'type',
        'status',
        'reason',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
