<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransportRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'direction',
        'driver_ids',
        'created_by',
    ];

    protected $casts = [
        'driver_ids' => 'array',
        'date' => 'date',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
