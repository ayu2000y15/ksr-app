<?php

namespace App\Http\Controllers;

use App\Models\InventoryCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;

class InventoryCategoryController extends Controller
{
    public function index()
    {
        $categories = InventoryCategory::orderBy('order_column')->get();
        return Inertia::render('inventory/categories/index', ['categories' => $categories]);
    }

    public function create()
    {
        return Inertia::render('inventory/categories/create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'order_column' => 'required|integer',
        ]);
        $cat = InventoryCategory::create($data);
        return redirect()->route('inventory.categories.index');
    }

    public function edit(InventoryCategory $category)
    {
        return Inertia::render('inventory/categories/edit', ['category' => $category]);
    }

    public function update(Request $request, InventoryCategory $category)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'order_column' => 'required|integer',
        ]);
        $category->update($data);
        return redirect()->route('inventory.categories.index');
    }

    public function destroy(InventoryCategory $category)
    {
        $category->delete();
        return redirect()->route('inventory.categories.index');
    }

    // reorder categories via POST { order: [id1, id2, ...] }
    public function reorder(Request $request)
    {
        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|distinct|exists:inventory_categories,id',
        ]);

        $order = $data['order'];
        try {
            foreach ($order as $index => $id) {
                InventoryCategory::where('id', $id)->update(['order_column' => $index]);
            }
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            Log::error('Failed to reorder categories: ' . $e->getMessage());
            return response()->json(['ok' => false, 'error' => 'reorder_failed'], 500);
        }
    }
}
