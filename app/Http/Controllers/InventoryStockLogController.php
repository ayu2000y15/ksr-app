<?php

namespace App\Http\Controllers;

use App\Models\InventoryStockLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class InventoryStockLogController extends Controller
{
    /**
     * Display a listing of the stock logs.
     */
    public function index(Request $request)
    {
        // ensure user can view logs
        $this->authorize('viewLogs', \App\Models\InventoryItem::class);
        // Allow sorting via query params but restrict to safe columns
        $allowed = ['change_date', 'quantity_before', 'quantity_after', 'inventory_item', 'storage_location', 'user'];
        $sort = $request->query('sort', 'change_date');
        $direction = $request->query('direction', 'desc') === 'asc' ? 'asc' : 'desc';

        // Map friendly sort keys to actual columns when necessary
        $query = InventoryStockLog::with(['inventoryStock.inventoryItem.category', 'user']);
        if ($sort === 'quantity_before' || $sort === 'quantity_after' || $sort === 'change_date') {
            $query = $query->orderBy($sort, $direction);
        } elseif ($sort === 'inventory_item') {
            // join via relation: order by inventory_item.name
            $query = $query->leftJoin('inventory_stock', 'inventory_stock.id', '=', 'inventory_stock_logs.inventory_stock_id')
                ->leftJoin('inventory_items', 'inventory_items.id', '=', 'inventory_stock.inventory_item_id')
                ->select('inventory_stock_logs.*')
                ->orderBy('inventory_items.name', $direction);
        } elseif ($sort === 'storage_location') {
            $query = $query->leftJoin('inventory_stock', 'inventory_stock.id', '=', 'inventory_stock_logs.inventory_stock_id')
                ->select('inventory_stock_logs.*')
                ->orderBy('inventory_stock.storage_location', $direction);
        } elseif ($sort === 'user') {
            $query = $query->leftJoin('users', 'users.id', '=', 'inventory_stock_logs.user_id')
                ->select('inventory_stock_logs.*')
                ->orderBy('users.name', $direction);
        } else {
            $query = $query->orderBy('change_date', 'desc');
        }

        $logs = $query->limit(100)->get();

        return Inertia::render('inventory/stock-logs/index', [
            'logs' => $logs,
            'queryParams' => [
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }
}
