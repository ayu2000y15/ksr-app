<?php

namespace App\Http\Controllers;

use App\Models\RentalItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;

class RentalItemController extends Controller
{
    /**
     * 貸出物マスタ一覧を表示
     */
    public function index()
    {
        $rentalItems = RentalItem::orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return Inertia::render('rental-items/index', [
            'rentalItems' => $rentalItems,
        ]);
    }

    /**
     * 貸出物マスタ新規作成フォームを表示
     */
    public function create()
    {
        return Inertia::render('rental-items/create');
    }

    /**
     * 貸出物マスタを保存
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'quantity' => 'required|integer|min:1',
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        RentalItem::create($validated);

        return Redirect::route('rental-items.index')->with('success', '貸出物を登録しました。');
    }

    /**
     * 貸出物マスタ編集フォームを表示
     */
    public function edit(RentalItem $rentalItem)
    {
        return Inertia::render('rental-items/edit', [
            'rentalItem' => $rentalItem,
        ]);
    }

    /**
     * 貸出物マスタを更新
     */
    public function update(Request $request, RentalItem $rentalItem)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'quantity' => 'required|integer|min:1',
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $rentalItem->update($validated);

        return Redirect::route('rental-items.index')->with('success', '貸出物を更新しました。');
    }

    /**
     * 貸出物マスタを削除
     */
    public function destroy(RentalItem $rentalItem)
    {
        $rentalItem->delete();

        return Redirect::route('rental-items.index')->with('success', '貸出物を削除しました。');
    }

    /**
     * 貸出物マスタの並び順を更新
     */
    public function reorder(Request $request)
    {
        $ids = $request->input('ids', []);

        foreach ($ids as $index => $id) {
            RentalItem::where('id', $id)->update(['sort_order' => $index + 1]);
        }

        return response()->json(['success' => true]);
    }
}
