<?php

namespace App\Models;

use App\Models\BaseModel;
use App\Models\InventoryItem;

class InventoryStock extends BaseModel
{
    protected $table = 'inventory_stock';

    protected $fillable = ['inventory_item_id', 'season_id', 'storage_location', 'quantity', 'memo', 'last_stocked_at'];

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function season()
    {
        return $this->belongsTo(\App\Models\Season::class, 'season_id');
    }
}
