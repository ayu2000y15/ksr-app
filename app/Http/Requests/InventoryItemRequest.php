<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class InventoryItemRequest extends FormRequest
{
    public function authorize()
    {
        return $this->user() != null; // basic auth guard; refine with policies if needed
    }

    public function attributes()
    {
        return [
            'name' => '名称',
            'items.*.name' => '名称',
            'category_id' => 'カテゴリ',
            'items.*.category_id' => 'カテゴリ',
            'items.*.stocks.*.storage_location' => '場所',
            'stocks.*.storage_location' => '場所',
            'items.*.stocks.*.quantity' => '在庫数',
            'stocks.*.quantity' => '在庫数',
        ];
    }

    public function rules()
    {
        return [
            // for single-item create require name/category when items[] is not present
            'name' => 'required_without:items|string|max:255',
            'category_id' => 'required_without:items|integer|exists:inventory_categories,id',
            'supplier_text' => 'nullable|string|max:1024',
            'catalog_name' => 'nullable|string|max:255',
            'size' => 'nullable|string|max:255',
            'unit' => 'nullable|string|max:50',
            'memo' => 'nullable|string',
            // stocks array: each entry may have storage_location, quantity (integer), memo
            'stocks' => 'nullable|array',
            'stocks.*.storage_location' => 'required_without:items|string|max:255',
            'stocks.*.quantity' => 'required_without:items|integer',
            'stocks.*.memo' => 'nullable|string',
            // bulk items payload
            'items' => 'nullable|array',
            'items.*.name' => 'required|string|max:255',
            'items.*.id' => 'nullable|integer|exists:inventory_items,id',
            'items.*.category_id' => 'required|integer|exists:inventory_categories,id',
            'items.*.catalog_name' => 'nullable|string|max:255',
            'items.*.size' => 'nullable|string|max:255',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.sort_order' => 'nullable|integer',
            'items.*.supplier_text' => 'nullable|string|max:1024',
            'items.*.memo' => 'nullable|string',
            // per-item multiple stocks support
            'items.*.stocks' => 'required|array|min:1',
            'items.*.stocks.*.storage_location' => 'required|string|max:255',
            'items.*.stocks.*.quantity' => 'required|integer',
            'items.*.stocks.*.memo' => 'nullable|string',
        ];
    }
}
