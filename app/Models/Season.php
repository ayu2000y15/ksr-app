<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Season extends Model
{
    protected $fillable = ['name', 'is_active', 'ended_at', 'note'];

    protected $casts = [
        'is_active' => 'boolean',
        'ended_at' => 'datetime',
    ];

    public function users()
    {
        return $this->hasMany(User::class, 'season_id');
    }

    public function inventoryStocks()
    {
        return $this->hasMany(InventoryStock::class, 'season_id');
    }

    public function damagedInventories()
    {
        return $this->hasMany(DamagedInventory::class, 'season_id');
    }

    public function properties()
    {
        return $this->hasMany(Property::class, 'season_id');
    }

    /**
     * 現在アクティブなシーズンを取得
     */
    public static function active(): ?self
    {
        return static::where('is_active', true)->first();
    }

    /**
     * セッションで選択中のシーズンを取得（未選択ならアクティブシーズン）
     */
    public static function viewing(): ?self
    {
        $id = session('viewing_season_id');
        if ($id) {
            $season = static::find($id);
            if ($season) {
                return $season;
            }
            // 無効なIDがセッションにある場合はクリア
            session()->forget('viewing_season_id');
        }
        return static::active();
    }

    /**
     * シーズンが終了しているかどうか
     */
    public function isEnded(): bool
    {
        return $this->ended_at !== null;
    }
}
