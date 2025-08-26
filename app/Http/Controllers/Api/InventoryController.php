<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InventoryItemRequest;
use App\Models\InventoryItem;
use App\Models\InventoryStock;
use App\Models\InventoryStockLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        // authorization: view inventory list
        $this->authorize('viewAny', \App\Models\InventoryItem::class);
        // include stocks so index responses contain per-item stock rows
        $query = InventoryItem::with(['category', 'stocks']);

        // simple search by name
        if ($q = $request->query('q')) {
            $query->where('name', 'like', "%{$q}%");
        }

        $items = $query->orderBy('sort_order')->orderBy('name')->paginate(15);
        return response()->json($items);
    }

    public function show(InventoryItem $inventory)
    {
        $this->authorize('view', $inventory);
        $inventory->load(['category']);
        // include stocks and latest logs
        $inventory->stocks = InventoryStock::where('inventory_item_id', $inventory->id)->get();
        return response()->json($inventory);
    }

    public function store(InventoryItemRequest $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);
        $data = $request->validated();

        // support bulk items[] creation: items[].* fields and optional items[].stock
        if ($request->filled('items') && is_array($data['items'])) {
            $created = [];
            $user = $request->user();
            DB::beginTransaction();
            try {
                foreach ($data['items'] as $it) {
                    // basic filtering: require name or catalog_name to create
                    $name = trim($it['name'] ?? '');
                    $catalog = trim($it['catalog_name'] ?? '');
                    if ($name === '' && $catalog === '') {
                        continue; // skip empty row
                    }

                    // prepare an empty collection for existing stocks so later logic can safely reference it
                    $existingStocks = collect();

                    if (!empty($it['id'])) {
                        // update existing
                        $item = InventoryItem::find($it['id']);
                        if ($item) {
                            $item->update([
                                'name' => $name,
                                'category_id' => $it['category_id'] ?? null,
                                'catalog_name' => $it['catalog_name'] ?? null,
                                'supplier_text' => $it['supplier_text'] ?? null,
                                'size' => $it['size'] ?? null,
                                'unit' => $it['unit'] ?? null,
                                'memo' => $it['memo'] ?? null,
                                'sort_order' => isset($it['sort_order']) ? intval($it['sort_order']) : null,
                            ]);
                            // load existing stocks keyed by storage_location for update-reuse
                            $existingStocks = InventoryStock::where('inventory_item_id', $item->id)->get()->keyBy(function ($s) {
                                return ($s->storage_location ?? '未設定');
                            });
                        } else {
                            // if id provided but not found, create new
                            $item = InventoryItem::create([
                                'name' => $name,
                                'category_id' => $it['category_id'] ?? null,
                                'catalog_name' => $it['catalog_name'] ?? null,
                                'supplier_text' => $it['supplier_text'] ?? null,
                                'size' => $it['size'] ?? null,
                                'unit' => $it['unit'] ?? null,
                                'memo' => $it['memo'] ?? null,
                            ]);
                        }
                    } else {
                        $item = InventoryItem::create([
                            'name' => $name,
                            'category_id' => $it['category_id'] ?? null,
                            'catalog_name' => $it['catalog_name'] ?? null,
                            'supplier_text' => $it['supplier_text'] ?? null,
                            'size' => $it['size'] ?? null,
                            'unit' => $it['unit'] ?? null,
                            'memo' => $it['memo'] ?? null,
                            'sort_order' => isset($it['sort_order']) ? intval($it['sort_order']) : null,
                        ]);
                    }

                    // update/create stocks if provided (items[].stocks[])
                    if (isset($it['stocks']) && is_array($it['stocks'])) {
                        // collect submitted locations to allow deletion of leftovers
                        $submittedLocations = [];
                        foreach ($it['stocks'] as $s) {
                            $hasAny = false;
                            if (!empty($s['storage_location'])) $hasAny = true;
                            if (isset($s['quantity']) && ($s['quantity'] !== '')) $hasAny = true;
                            if (!$hasAny) continue;

                            $loc = $s['storage_location'] ?? '未設定';
                            $qty = intval($s['quantity'] ?? 0);
                            $submittedLocations[] = $loc;

                            $stock = null;
                            // prefer matching by provided id
                            if (!empty($s['id'])) {
                                $stock = InventoryStock::where('id', $s['id'])->where('inventory_item_id', $item->id)->first();
                            }
                            // fallback: match by location in existingStocks
                            if (!$stock && $existingStocks->has($loc)) {
                                $stock = $existingStocks->get($loc);
                            }

                            if ($stock) {
                                $beforeQty = intval($stock->quantity);
                                $stock->storage_location = $loc;
                                $stock->quantity = $qty;
                                $stock->memo = $s['memo'] ?? $stock->memo;
                                $stock->last_stocked_at = now();
                                $stock->save();

                                if ($beforeQty !== $qty) {
                                    InventoryStockLog::create([
                                        'inventory_stock_id' => $stock->id,
                                        'user_id' => $user ? $user->id : null,
                                        'change_date' => now(),
                                        'quantity_before' => $beforeQty,
                                        'quantity_after' => $qty,
                                        'reason' => null,
                                    ]);
                                }
                            } else {
                                // create new stock
                                $newStock = InventoryStock::create([
                                    'inventory_item_id' => $item->id,
                                    'storage_location' => $loc,
                                    'quantity' => $qty,
                                    'memo' => $s['memo'] ?? null,
                                    'last_stocked_at' => now(),
                                ]);

                                if ($qty !== 0) {
                                    InventoryStockLog::create([
                                        'inventory_stock_id' => $newStock->id,
                                        'user_id' => $user ? $user->id : null,
                                        'change_date' => now(),
                                        'quantity_before' => 0,
                                        'quantity_after' => $qty,
                                        'reason' => null,
                                    ]);
                                }
                            }
                        }

                        // delete existing stocks that were not submitted
                        foreach ($existingStocks as $loc => $es) {
                            if (!in_array($loc, $submittedLocations, true)) {
                                // optional: if you want to log deletions as zeroing, implement here
                                $es->delete();
                            }
                        }
                    }

                    $created[] = $item;
                }

                DB::commit();
                return response()->json(['created' => $created], 201);
            } catch (\Exception $e) {
                DB::rollBack();
                return response()->json(['message' => 'failed', 'error' => $e->getMessage()], 500);
            }
        }

        // fallback: single item create (legacy)
        $item = InventoryItem::create($data);
        return response()->json($item, 201);
    }

    public function update(InventoryItemRequest $request, InventoryItem $inventory)
    {
        $this->authorize('update', $inventory);
        $data = $request->validated();
        $inventory->update($data);
        return response()->json($inventory);
    }

    public function destroy(InventoryItem $inventory)
    {
        $this->authorize('delete', $inventory);
        $inventory->delete();
        return response()->json(['message' => 'deleted']);
    }

    // inventory stock adjustment endpoint
    public function adjustStock(Request $request, InventoryItem $inventory)
    {
        $this->authorize('update', $inventory);
        $request->validate([
            'inventory_stock_id' => 'nullable|integer',
            'storage_location' => 'nullable|string|max:255',
            'quantity_change' => 'required|integer',
            'reason' => 'nullable|string|max:255',
        ]);

        $user = $request->user();

        DB::beginTransaction();
        try {
            $stock = null;
            if ($request->filled('inventory_stock_id')) {
                $stock = InventoryStock::findOrFail($request->input('inventory_stock_id'));
                $before = $stock->quantity;
                $stock->quantity = $stock->quantity + intval($request->input('quantity_change'));
                $stock->last_stocked_at = now();
                $stock->save();
            } else {
                // create new stock row
                $stock = InventoryStock::create([
                    'inventory_item_id' => $inventory->id,
                    'storage_location' => $request->input('storage_location') ?? '未設定',
                    'quantity' => intval($request->input('quantity_change')),
                    'memo' => null,
                    'last_stocked_at' => now(),
                ]);
                $before = 0;
            }

            $log = InventoryStockLog::create([
                'inventory_stock_id' => $stock->id,
                'user_id' => $user->id,
                'change_date' => now(),
                'quantity_before' => $before,
                'quantity_after' => $stock->quantity,
                'reason' => $request->input('reason'),
            ]);

            DB::commit();
            return response()->json(['stock' => $stock, 'log' => $log]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'failed', 'error' => $e->getMessage()], 500);
        }
    }
}
