<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\InventoryItem;

class InventoryStock extends Model
{
    protected $table = 'inventory_stock';

    protected $fillable = ['inventory_item_id', 'storage_location', 'quantity', 'memo', 'last_stocked_at'];

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }
}
