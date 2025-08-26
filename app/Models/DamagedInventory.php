<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DamagedInventory extends Model
{
    use HasFactory;

    protected $table = 'damaged_inventories';

    protected $fillable = [
        'inventory_item_id',
        'handler_user_id',
        'management_number',
        'damaged_at',
        'damage_condition_id',
        'damaged_area',
        'customer_name',
        'customer_phone',
        'customer_id_image_path',
        'compensation_amount',
        'payment_method',
        'receipt_number',
        'receipt_image_path',
        'memo',
    ];

    protected $casts = [
        // keep as date (Y-m-d) when serialized to JSON to avoid timezone shifts on the client
        'damaged_at' => 'date',
    ];

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function handlerUser()
    {
        return $this->belongsTo(User::class, 'handler_user_id');
    }

    public function damageCondition()
    {
        return $this->belongsTo(DamageCondition::class, 'damage_condition_id');
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
