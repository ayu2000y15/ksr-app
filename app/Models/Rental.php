<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Rental extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * fillable属性
     */
    protected $fillable = [
        'user_id',
        'rental_item_id',
        'item_number',
        'rental_date',
        'rental_user_id',
        'return_date',
        'return_user_id',
        'notes',
    ];

    /**
     * キャスト設定
     */
    protected $casts = [
        'rental_date' => 'date',
        'return_date' => 'date',
    ];

    /**
     * 貸出を受けるユーザー
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * 貸出対応者
     */
    public function rentalUser()
    {
        return $this->belongsTo(User::class, 'rental_user_id');
    }

    /**
     * 返却対応者
     */
    public function returnUser()
    {
        return $this->belongsTo(User::class, 'return_user_id');
    }

    /**
     * 貸出物マスタ
     */
    public function rentalItem()
    {
        return $this->belongsTo(RentalItem::class, 'rental_item_id');
    }
}
