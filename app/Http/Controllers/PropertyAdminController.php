<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

class PropertyAdminController extends Controller
{
    public function index(\Illuminate\Http\Request $request)
    {
        $this->authorize('viewAny', Property::class);

        // accept query params for server-side sorting. We'll support a simple "list" selector
        // so the page can request sorting for the active tab only (list=agents|properties|furnitures)
        $queryParams = $request->query();
        $list = $request->get('list', 'agents');
        $sort = $request->get('sort', null);
        $direction = strtolower($request->get('direction', 'asc'));
        if ($direction !== 'asc' && $direction !== 'desc') $direction = 'asc';

        // Real estate agents
        $agentsQuery = \App\Models\RealEstateAgent::query();
        if ($list === 'agents' && $sort) {
            // whitelist allowed sort keys
            if (in_array($sort, ['id', 'name', 'order_column'])) {
                $agentsQuery->orderBy($sort, $direction);
            } else {
                $agentsQuery->orderBy('order_column')->orderBy('name');
            }
        } else {
            $agentsQuery->orderBy('order_column')->orderBy('name');
        }
        $agents = $agentsQuery->get();

        // Properties
        $propertiesQuery = Property::query()->select('properties.*');
        if ($list === 'properties' && $sort) {
            // support simple mappings and a related-agent name sort
            if ($sort === 'id' || $sort === 'name' || $sort === 'order_column' || $sort === 'contract_date') {
                $propertiesQuery->orderBy($sort, $direction);
            } elseif ($sort === 'termination_date') {
                // frontend calls termination_date, DB column is cancellation_date
                $propertiesQuery->orderBy('cancellation_date', $direction);
            } elseif ($sort === 'real_estate_agent.name' || $sort === 'agent_name') {
                // join agents for ordering by agent name
                $propertiesQuery->leftJoin('real_estate_agents', 'properties.real_estate_agent_id', '=', 'real_estate_agents.id')
                    ->orderBy('real_estate_agents.name', $direction)
                    ->select('properties.*');
            } else {
                $propertiesQuery->orderBy('order_column')->orderBy('name');
            }
        } else {
            $propertiesQuery->orderBy('order_column')->orderBy('name');
        }
        $items = $propertiesQuery->get();
        // add frontend-friendly keys so client code can read `postcode` and `termination_date`
        $items = $items->map(function ($it) {
            $arr = $it->toArray();
            $arr['postcode'] = $it->postal_code ?? null;
            $arr['termination_date'] = $it->cancellation_date ?? null;
            return $arr;
        });

        // Furniture masters
        $furnituresQuery = \App\Models\FurnitureMaster::query();
        if ($list === 'furnitures' && $sort) {
            if (in_array($sort, ['id', 'name', 'order_column'])) {
                $furnituresQuery->orderBy($sort, $direction);
            } else {
                $furnituresQuery->orderBy('order_column')->orderBy('name');
            }
        } else {
            $furnituresQuery->orderBy('order_column')->orderBy('name');
        }
        $furnitures = $furnituresQuery->get();

        // build map of property_id => array of furniture_master_id already attached
        // and also a list of detailed rows for UI (quantity, removal dates)
        $propertyFurnitureRows = \App\Models\PropertyFurniture::query()->get();
        $propertyFurnituresMap = [];
        $propertyFurnituresDetails = [];
        foreach ($propertyFurnitureRows as $row) {
            $pid = $row->property_id;
            $fid = $row->furniture_master_id;
            if (!array_key_exists($pid, $propertyFurnituresMap)) $propertyFurnituresMap[$pid] = [];
            $propertyFurnituresMap[$pid][] = $fid;

            if (!array_key_exists($pid, $propertyFurnituresDetails)) $propertyFurnituresDetails[$pid] = [];
            $propertyFurnituresDetails[$pid][] = [
                'id' => $row->id,
                'furniture_master_id' => $fid,
                'quantity' => $row->quantity,
                'removal_start_date' => $row->removal_start_date,
                'removal_date' => $row->removal_date,
            ];
        }

        // render Inertia page and include queryParams so the client can show current sort state
        return Inertia::render('properties/admin/index', [
            'properties' => $items,
            'agents' => $agents,
            'furnitures' => $furnitures,
            'property_furnitures_map' => $propertyFurnituresMap,
            'property_furnitures_details' => $propertyFurnituresDetails,
            'queryParams' => $queryParams,
        ]);
    }

    public function destroy(Property $property, Request $request)
    {
        $this->authorize('delete', $property);
        try {
            $property->delete();
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['message' => '物件を削除しました'], 200);
            }
            return redirect()->route('properties.admin')->with('success', '物件を削除しました');
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
        $this->authorize('create', Property::class);
        return Inertia::render('properties/admin/create');
    }

    public function store(Request $request)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'real_estate_agent_id' => 'required|exists:real_estate_agents,id',
            'postcode' => 'nullable|string|max:20',
            'address' => 'required|string|max:500',
            'parking' => 'required|in:0,1',
            'layout' => 'nullable|string|max:100',
            'contract_date' => 'required|date',
            'termination_date' => 'nullable|date',
            'room_details' => 'nullable|string|max:200',
            'memo' => 'nullable|string|max:2000',
            'order_column' => 'nullable|integer|min:0',
            'key_returned' => 'nullable|in:0,1',
        ], [], [
            'name' => '物件名',
            'real_estate_agent_id' => '不動産会社',
            'postcode' => '郵便番号',
            'address' => '住所',
            'parking' => '駐車場',
            'layout' => '間取り',
            'contract_date' => '物件契約日',
            'termination_date' => '物件解約日',
            'room_details' => '部屋番号',
            'memo' => 'メモ',
            'order_column' => '並び順',
            'key_returned' => '鍵返却',
        ]);

        if ($validator->fails()) {
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        // Map frontend field names to DB column names used by the Property model/migration
        $mapped = [];
        $mapped['name'] = $data['name'];
        $mapped['real_estate_agent_id'] = $data['real_estate_agent_id'];
        // frontend sends `postcode` but DB column is `postal_code`
        $mapped['postal_code'] = $data['postcode'] ?? null;
        $mapped['address'] = $data['address'];
        // frontend sends `parking` (0/1) but DB column is `has_parking`
        $mapped['has_parking'] = array_key_exists('parking', $data) ? intval($data['parking']) : 0;
        $mapped['layout'] = $data['layout'] ?? null;
        $mapped['contract_date'] = $data['contract_date'];
        // frontend uses `termination_date`, DB column is `cancellation_date`
        $mapped['cancellation_date'] = $data['termination_date'] ?? null;
        // frontend uses `room_details`, DB column is `room_details`
        $mapped['room_details'] = $data['room_details'] ?? null;
        $mapped['memo'] = $data['memo'] ?? null;
        $mapped['order_column'] = array_key_exists('order_column', $data) && $data['order_column'] !== null ? $data['order_column'] : 0;
        $mapped['key_returned'] = array_key_exists('key_returned', $data) ? intval($data['key_returned']) : 0;

        $prop = Property::create($mapped);

        // include frontend-friendly aliases in JSON response
        $propArr = array_merge($prop->toArray(), [
            'postcode' => $prop->postal_code ?? null,
            'termination_date' => $prop->cancellation_date ?? null,
        ]);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '物件を作成しました', 'property' => $propArr], 201);
        }

        return redirect()->route('properties.admin')->with('success', '物件を作成しました');
    }

    public function update(Request $request, Property $property)
    {
        $this->authorize('update', $property);

        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'real_estate_agent_id' => 'required|exists:real_estate_agents,id',
            'postcode' => 'nullable|string|max:20',
            'address' => 'required|string|max:500',
            'parking' => 'required|in:0,1',
            'layout' => 'nullable|string|max:100',
            'contract_date' => 'required|date',
            'termination_date' => 'nullable|date',
            'room_details' => 'nullable|string|max:200',
            'memo' => 'nullable|string|max:2000',
            'order_column' => 'nullable|integer|min:0',
            'key_returned' => 'nullable|in:0,1',
        ], [], [
            'name' => '物件名',
            'real_estate_agent_id' => '不動産会社',
            'postcode' => '郵便番号',
            'address' => '住所',
            'parking' => '駐車場',
            'layout' => '間取り',
            'contract_date' => '物件契約日',
            'termination_date' => '物件解約日',
            'room_details' => '部屋情報',
            'memo' => 'メモ',
            'order_column' => '並び順',
            'key_returned' => '鍵返却',
        ]);

        if ($validator->fails()) {
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        $mapped = [];
        $mapped['name'] = $data['name'];
        $mapped['real_estate_agent_id'] = $data['real_estate_agent_id'];
        $mapped['postal_code'] = $data['postcode'] ?? null;
        $mapped['address'] = $data['address'];
        $mapped['has_parking'] = array_key_exists('parking', $data) ? intval($data['parking']) : 0;
        $mapped['layout'] = $data['layout'] ?? null;
        $mapped['contract_date'] = $data['contract_date'];
        $mapped['cancellation_date'] = $data['termination_date'] ?? null;
        $mapped['room_details'] = $data['room_details'] ?? null;
        $mapped['memo'] = $data['memo'] ?? null;
        $mapped['order_column'] = array_key_exists('order_column', $data) && $data['order_column'] !== null ? $data['order_column'] : 0;
        $mapped['key_returned'] = array_key_exists('key_returned', $data) ? intval($data['key_returned']) : 0;

        $property->fill($mapped);
        $property->save();

        $propertyArr = array_merge($property->toArray(), [
            'postcode' => $property->postal_code ?? null,
            'termination_date' => $property->cancellation_date ?? null,
        ]);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['message' => '物件を更新しました', 'property' => $propertyArr], 200);
        }

        return redirect()->route('properties.admin')->with('success', '物件を更新しました');
    }

    // reorder properties via POST { order: [id1, id2, ...] }
    public function reorder(Request $request)
    {
        $this->authorize('viewAny', Property::class);

        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|distinct|exists:properties,id',
        ]);

        $order = $data['order'];
        try {
            foreach ($order as $index => $id) {
                Property::where('id', $id)->update(['order_column' => $index]);
            }
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'reorder_failed'], 500);
        }
    }
}
