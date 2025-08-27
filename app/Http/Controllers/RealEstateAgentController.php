<?php

namespace App\Http\Controllers;

use App\Models\RealEstateAgent;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\QueryException;

class RealEstateAgentController extends Controller
{
    public function index()
    {
        $items = RealEstateAgent::orderBy('order_column')->get();
        return Inertia::render('properties/masters/real-estate-agents/index', ['agents' => $items]);
    }

    public function destroy(RealEstateAgent $real_estate_agent, Request $request)
    {
        try {
            $real_estate_agent->delete();
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['message' => '不動産会社を削除しました'], 200);
            }
            return redirect()->route('properties.masters.real-estate-agents.index')->with('success', '不動産会社を削除しました');
        } catch (QueryException $e) {
            // likely foreign key constraint
            $msg = '他のデータで参照されているため削除できません';
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['message' => $msg], 409);
            }
            return redirect()->back()->with('error', $msg);
        }
    }

    public function create()
    {
        return Inertia::render('properties/masters/real-estate-agents/create');
    }

    public function store(Request $request)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'order_column' => 'nullable|integer|min:0',
        ], [], [
            'name' => '不動産会社名',
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
        $agent = RealEstateAgent::create($data);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '不動産会社を作成しました', 'agent' => $agent], 201);
        }

        return redirect()->route('properties.masters.real-estate-agents.index')->with('success', '不動産会社を作成しました');
    }

    public function update(Request $request, RealEstateAgent $real_estate_agent)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'order_column' => 'nullable|integer|min:0',
        ], [], [
            'name' => '不動産会社名',
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

        $real_estate_agent->fill($data);
        $real_estate_agent->save();

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '不動産会社を更新しました', 'agent' => $real_estate_agent], 200);
        }

        return redirect()->route('properties.masters.real-estate-agents.index')->with('success', '不動産会社を更新しました');
    }

    // reorder real estate agents via POST { order: [id1, id2, ...] }
    public function reorder(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|distinct|exists:real_estate_agents,id',
        ]);

        $order = $data['order'];
        try {
            foreach ($order as $index => $id) {
                RealEstateAgent::where('id', $id)->update(['order_column' => $index]);
            }
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'reorder_failed'], 500);
        }
    }
}
