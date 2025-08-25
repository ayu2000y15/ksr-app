<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\InventoryCategory;
use App\Models\Supplier;

class InventoryItem extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'category_id', 'supplier_id', 'supplier_text', 'catalog_name', 'size', 'unit', 'memo', 'sort_order'];

    /**
     * Category relation
     */
    public function category()
    {
        return $this->belongsTo(InventoryCategory::class, 'category_id');
    }

    /**
     * Supplier relation (kept for backward compatibility)
     */
    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    /**
     * Stocks relation (multiple storage rows per item)
     */
    public function stocks()
    {
        return $this->hasMany(InventoryStock::class, 'inventory_item_id');
    }
}
