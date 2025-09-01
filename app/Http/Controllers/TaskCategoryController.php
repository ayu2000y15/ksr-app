<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\TaskCategory;

class TaskCategoryController
{
    public function index()
    {
        // Order by order_column first so UI dropdown follows configured order, fallback by name
        $cats = TaskCategory::orderBy('order_column', 'asc')->orderBy('name')->get();
        return response()->json(['categories' => $cats], 200);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'order_column' => 'sometimes|integer',
            'color' => ['nullable', 'regex:/^#([0-9A-Fa-f]{6})$/'],
        ]);
        $cat = TaskCategory::create([
            'name' => $data['name'],
            'order_column' => $data['order_column'] ?? 0,
            'color' => $data['color'] ?? null,
        ]);
        return response()->json(['category' => $cat, 'message' => '作成しました'], 201);
    }

    public function destroy($id)
    {
        $c = TaskCategory::find($id);
        if (!$c) return response()->json(['message' => 'カテゴリが見つかりません'], 404);
        try {
            $c->delete();
            return response()->json(['message' => '削除しました'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => '削除に失敗しました'], 500);
        }
    }
}
