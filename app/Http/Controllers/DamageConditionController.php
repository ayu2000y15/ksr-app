<?php

namespace App\Http\Controllers;

use App\Models\DamageCondition;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;

class DamageConditionController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', \App\Models\InventoryItem::class);

        $items = DamageCondition::orderBy('order_column')->get();
        return Inertia::render('inventory/damage-conditions/index', ['items' => $items]);
    }

    public function create()
    {
        $this->authorize('create', \App\Models\InventoryItem::class);
        return Inertia::render('inventory/damage-conditions/create');
    }

    public function store(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $data = $request->validate([
            'condition' => 'required|string|max:255',
            'order_column' => 'required|integer',
        ]);
        DamageCondition::create($data);
        return redirect()->route('inventory.damage-conditions.index');
    }

    public function edit(DamageCondition $damage_condition)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);
        return Inertia::render('inventory/damage-conditions/edit', ['damage_condition' => $damage_condition]);
    }

    public function update(Request $request, DamageCondition $damage_condition)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $data = $request->validate([
            'condition' => 'required|string|max:255',
            'order_column' => 'required|integer',
        ]);
        $damage_condition->update($data);
        return redirect()->route('inventory.damage-conditions.index');
    }

    public function destroy(Request $request, DamageCondition $damage_condition)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);
        // Prevent deletion if referenced by any damaged inventories
        $inUse = \App\Models\DamagedInventory::where('damage_condition_id', $damage_condition->id)->exists();
        if ($inUse) {
            $msg = 'この破損状態は既に使用されているため削除できません';
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['error' => $msg], 409);
            }
            return redirect()->route('inventory.damage-conditions.index')
                ->with('error', $msg);
        }

        $damage_condition->delete();
        $msg = '破損状態を削除しました';
        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['success' => $msg]);
        }
        return redirect()->route('inventory.damage-conditions.index')
            ->with('success', $msg);
    }

    public function reorder(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|distinct|exists:damage_conditions,id',
        ]);

        $order = $data['order'];
        try {
            foreach ($order as $index => $id) {
                DamageCondition::where('id', $id)->update(['order_column' => $index]);
            }
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            Log::error('Failed to reorder damage conditions: ' . $e->getMessage());
            return response()->json(['ok' => false, 'error' => 'reorder_failed'], 500);
        }
    }
}
