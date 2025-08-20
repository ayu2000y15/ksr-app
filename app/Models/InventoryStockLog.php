<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryStockLog extends Model
{
    protected $fillable = [
        'inventory_stock_id',
        'user_id',
        'change_date',
        'quantity_before',
        'quantity_after',
        'reason',
    ];
}
