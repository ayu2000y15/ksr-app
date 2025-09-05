<?php

namespace App\Models;

use App\Models\BaseModel;
use App\Models\InventoryItem;

class InventoryStock extends BaseModel
{
    protected $table = 'inventory_stock';

    protected $fillable = ['inventory_item_id', 'storage_location', 'quantity', 'memo', 'last_stocked_at'];

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }
}
