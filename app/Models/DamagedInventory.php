<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DamagedInventory extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventory_item_id',
        'handler_user_id',
        'management_number',
        'damaged_at',
        'damage_condition_id',
        'damaged_area',
        'customer_name',
        'customer_phone',
        'compensation_amount',
        'payment_method',
        'receipt_number',
        'receipt_image_path',
        'memo',
    ];

    protected function casts(): array
    {
        return [
            'damaged_at' => 'date',
        ];
    }

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function handler()
    {
        return $this->belongsTo(User::class, 'handler_user_id');
    }
}
