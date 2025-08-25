<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryCategory;
// Supplier master removed; using free-text supplier field on inventory_items
use Inertia\Inertia;
use Illuminate\Http\Request;

class InventoryPageController extends Controller
{
    public function index(Request $request)
    {
        // include stocks so the Inertia index page receives per-item stock rows
        $items = InventoryItem::with(['category', 'stocks'])->orderBy('sort_order')->orderBy('name')->paginate(15);
        $categories = InventoryCategory::orderBy('order_column')->get();
        return Inertia::render('inventory/index', [
            'items' => $items,
            'categories' => $categories,
        ]);
    }

    public function create()
    {
        $categories = InventoryCategory::orderBy('order_column')->get();
        // load existing items so the page can be used as an edit grid
        $items = InventoryItem::with(['stocks', 'category'])->orderBy('sort_order')->orderBy('name')->get();
        return Inertia::render('inventory/create', [
            'categories' => $categories,
            'items' => $items,
        ]);
    }
}
