<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RentalItem extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * fillable属性
     */
    protected $fillable = [
        'name',
        'description',
        'quantity',
        'is_active',
        'sort_order',
    ];

    /**
     * キャスト設定
     */
    protected $casts = [
        'is_active' => 'boolean',
        'quantity' => 'integer',
        'sort_order' => 'integer',
    ];

    /**
     * この貸出物に関連する貸出履歴
     */
    public function rentals()
    {
        return $this->hasMany(Rental::class, 'rental_item_id');
    }
}
