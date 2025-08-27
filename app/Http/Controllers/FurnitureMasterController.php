<?php

namespace App\Http\Controllers;

use App\Models\FurnitureMaster;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\QueryException;

class FurnitureMasterController extends Controller
{
    public function index()
    {
        $items = FurnitureMaster::orderBy('order_column')->get();
        return Inertia::render('properties/masters/furniture-masters/index', ['items' => $items]);
    }

    public function destroy(FurnitureMaster $furniture_master, Request $request)
    {
        try {
            $furniture_master->delete();
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['message' => '家具を削除しました'], 200);
            }
            return redirect()->route('properties.masters.furniture-masters.index')->with('success', '家具を削除しました');
        } catch (QueryException $e) {
            $msg = '他のデータで参照されているため削除できません';
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['message' => $msg], 409);
            }
            return redirect()->back()->with('error', $msg);
        }
    }

    public function create()
    {
        return Inertia::render('properties/masters/furniture-masters/create');
    }

    public function store(Request $request)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'order_column' => 'nullable|integer|min:0',
        ], [], [
            'name' => '家具名',
            'order_column' => '並び順',
        ]);

        if ($validator->fails()) {
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();
        if (!array_key_exists('order_column', $data) || $data['order_column'] === null) {
            $data['order_column'] = 0;
        }
        $item = FurnitureMaster::create($data);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '家具を作成しました', 'furniture' => $item], 201);
        }

        return redirect()->route('properties.masters.furniture-masters.index')->with('success', '家具を作成しました');
    }

    public function update(Request $request, FurnitureMaster $furniture_master)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'order_column' => 'nullable|integer|min:0',
        ], [], [
            'name' => '家具名',
            'order_column' => '並び順',
        ]);

        if ($validator->fails()) {
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();
        if (!array_key_exists('order_column', $data) || $data['order_column'] === null) {
            $data['order_column'] = 0;
        }

        $furniture_master->fill($data);
        $furniture_master->save();

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '家具を更新しました', 'furniture' => $furniture_master], 200);
        }

        return redirect()->route('properties.masters.furniture-masters.index')->with('success', '家具を更新しました');
    }

    // reorder furniture masters via POST { order: [id1, id2, ...] }
    public function reorder(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|distinct|exists:furniture_masters,id',
        ]);

        $order = $data['order'];
        try {
            foreach ($order as $index => $id) {
                FurnitureMaster::where('id', $id)->update(['order_column' => $index]);
            }
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'reorder_failed'], 500);
        }
    }
}
