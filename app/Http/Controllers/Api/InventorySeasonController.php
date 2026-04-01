<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventorySeason;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventorySeasonController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', \App\Models\InventoryItem::class);

        $seasons = InventorySeason::orderBy('name', 'desc')->get();
        return response()->json($seasons);
    }

    public function store(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:20', 'unique:inventory_seasons,name', 'regex:/^\d{4}-\d{2}$/'],
            'is_active' => ['boolean'],
            'note'      => ['nullable', 'string', 'max:255'],
        ], [
            'name.required' => 'シーズン名は必須です',
            'name.unique'   => 'そのシーズン名は既に登録されています',
            'name.regex'    => 'シーズン名は YYYY-YY 形式で入力してください（例: 2025-26）',
        ]);

        DB::beginTransaction();
        try {
            if (!empty($validated['is_active'])) {
                // 他のシーズンのアクティブフラグを解除
                InventorySeason::where('is_active', true)->update(['is_active' => false]);
            }

            $season = InventorySeason::create($validated);
            DB::commit();
            return response()->json($season, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => '作成に失敗しました', 'error' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, InventorySeason $inventorySeason)
    {
        $this->authorize('update', \App\Models\InventoryItem::class);

        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:20', 'unique:inventory_seasons,name,' . $inventorySeason->id, 'regex:/^\d{4}-\d{2}$/'],
            'is_active' => ['boolean'],
            'note'      => ['nullable', 'string', 'max:255'],
        ], [
            'name.unique' => 'そのシーズン名は既に登録されています',
            'name.regex'  => 'シーズン名は YYYY-YY 形式で入力してください（例: 2025-26）',
        ]);

        DB::beginTransaction();
        try {
            if (isset($validated['is_active']) && $validated['is_active']) {
                InventorySeason::where('id', '!=', $inventorySeason->id)
                    ->where('is_active', true)
                    ->update(['is_active' => false]);
            }

            $inventorySeason->update($validated);
            DB::commit();
            return response()->json($inventorySeason->fresh());
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => '更新に失敗しました', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy(InventorySeason $inventorySeason)
    {
        $this->authorize('delete', \App\Models\InventoryItem::class);

        $stockCount = $inventorySeason->stocks()->count();
        if ($stockCount > 0) {
            return response()->json([
                'message' => "このシーズンには在庫データ（{$stockCount}件）が登録されています。削除できません。",
            ], 422);
        }

        $inventorySeason->delete();
        return response()->json(['message' => 'deleted']);
    }

    /**
     * 指定シーズンをアクティブに設定し、他のシーズンを非アクティブにする
     */
    public function setActive(int $id)
    {
        $this->authorize('update', \App\Models\InventoryItem::class);

        $season = InventorySeason::findOrFail($id);

        DB::transaction(function () use ($season) {
            InventorySeason::where('is_active', true)->update(['is_active' => false]);
            $season->update(['is_active' => true]);
        });

        return response()->json($season->fresh());
    }
}
