<?php

namespace App\Http\Controllers;

use App\Models\PropertyFurniture;
use App\Models\Property;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PropertyFurnitureController extends Controller
{
    /**
     * Store a newly created property furniture linked to a property.
     */
    public function store(Request $request)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'property_id' => 'required|exists:properties,id',
            'furniture_master_id' => 'required|exists:furniture_masters,id',
            'quantity' => 'required|integer|min:0',
            'removal_start_date' => 'nullable|date',
            'removal_date' => 'nullable|date',
        ], [], [
            'property_id' => '物件',
            'furniture_master_id' => '家具',
            'quantity' => '個数',
            'removal_start_date' => '搬出開始日',
            'removal_date' => '搬出日',
        ]);

        if ($validator->fails()) {
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        // authorize: user must be able to update the property
        $property = Property::findOrFail($data['property_id']);
        \Illuminate\Support\Facades\Gate::authorize('update', $property);

        $pf = PropertyFurniture::create([
            'property_id' => $data['property_id'],
            'furniture_master_id' => $data['furniture_master_id'],
            'quantity' => $data['quantity'],
            'removal_start_date' => $data['removal_start_date'] ?? null,
            'removal_date' => $data['removal_date'] ?? null,
        ]);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '家具を登録しました', 'property_furniture' => $pf], 201);
        }

        return redirect()->back()->with('success', '家具を登録しました');
    }

    /**
     * Update an existing property furniture row.
     */
    public function update(Request $request, PropertyFurniture $property_furniture)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'property_id' => 'required|exists:properties,id',
            'furniture_master_id' => 'required|exists:furniture_masters,id',
            'quantity' => 'required|integer|min:0',
            'removal_start_date' => 'nullable|date',
            'removal_date' => 'nullable|date',
        ], [], [
            'property_id' => '物件',
            'furniture_master_id' => '家具',
            'quantity' => '個数',
            'removal_start_date' => '搬出開始日',
            'removal_date' => '搬出日',
        ]);

        if ($validator->fails()) {
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        // authorize: user must be able to update the property
        $property = Property::findOrFail($data['property_id']);
        \Illuminate\Support\Facades\Gate::authorize('update', $property);

        $property_furniture->property_id = $data['property_id'];
        $property_furniture->furniture_master_id = $data['furniture_master_id'];
        $property_furniture->quantity = $data['quantity'];
        $property_furniture->removal_start_date = $data['removal_start_date'] ?? null;
        $property_furniture->removal_date = $data['removal_date'] ?? null;
        $property_furniture->save();

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '物件の家具を更新しました', 'property_furniture' => $property_furniture], 200);
        }

        return redirect()->back()->with('success', '物件の家具を更新しました');
    }

    /**
     * Remove the specified property furniture.
     */
    public function destroy(Request $request, PropertyFurniture $property_furniture)
    {
        // authorize
        $property = Property::findOrFail($property_furniture->property_id);
        \Illuminate\Support\Facades\Gate::authorize('update', $property);

        try {
            $property_furniture->delete();
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['message' => '登録を削除しました'], 200);
            }
            return redirect()->back()->with('success', '登録を削除しました');
        } catch (\Illuminate\Database\QueryException $e) {
            // likely foreign key constraint
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['message' => '他のデータで参照されているため削除できません'], 409);
            }
            return redirect()->back()->with('error', '他のデータで参照されているため削除できません');
        }
    }
}
