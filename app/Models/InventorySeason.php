<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventorySeason extends Model
{
    protected $fillable = ['name', 'is_active', 'note'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function stocks()
    {
        return $this->hasMany(InventoryStock::class, 'season_id');
    }
}
