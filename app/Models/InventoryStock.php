<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryStock extends Model
{
    protected $table = 'inventory_stock';

    protected $fillable = ['inventory_item_id', 'storage_location', 'quantity', 'memo', 'last_stocked_at'];
}
