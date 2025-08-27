<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\DamagedInventory;
use App\Models\InventoryItem;
use App\Models\DamageCondition;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use App\Services\AttachmentService;

class DamagedInventoryController extends Controller
{
    protected $attachmentService;

    public function __construct(AttachmentService $attachmentService)
    {
        $this->attachmentService = $attachmentService;
    }
    public function index()
    {
        $sort = request()->query('sort');
        $direction = strtolower(request()->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';

        // whitelist allowed sort keys and map to actual columns (optionally requiring a join)
        $sortMap = [
            'damaged_at' => ['type' => 'column', 'value' => 'damaged_inventories.damaged_at'],
            'id' => ['type' => 'column', 'value' => 'damaged_inventories.id'],
            'management_number' => ['type' => 'column', 'value' => 'damaged_inventories.management_number'],
            // related columns (require left join)
            'inventory_item.name' => ['type' => 'join', 'table' => 'inventory_items', 'local_key' => 'inventory_item_id', 'foreign_col' => 'name'],
            'handler_user.name' => ['type' => 'join', 'table' => 'users', 'local_key' => 'handler_user_id', 'foreign_col' => 'name'],
        ];

        $query = DamagedInventory::query();
        // eager load relations for response
        $query->with(['inventoryItem.category', 'handlerUser', 'damageCondition', 'attachments']);

        if ($sort && isset($sortMap[$sort])) {
            $m = $sortMap[$sort];
            if ($m['type'] === 'column') {
                $query->orderBy($m['value'], $direction);
            } else {
                // perform left join to allow ordering by related table column
                if ($m['table'] === 'inventory_items') {
                    $query->select('damaged_inventories.*')
                        ->leftJoin('inventory_items', 'damaged_inventories.inventory_item_id', '=', 'inventory_items.id')
                        ->orderBy('inventory_items.' . $m['foreign_col'], $direction);
                } elseif ($m['table'] === 'users') {
                    $query->select('damaged_inventories.*')
                        ->leftJoin('users', 'damaged_inventories.handler_user_id', '=', 'users.id')
                        ->orderBy('users.' . $m['foreign_col'], $direction);
                }
            }
        } else {
            // default ordering
            $query->orderBy('damaged_inventories.damaged_at', 'desc')->orderBy('damaged_inventories.id', 'desc');
        }

        $damaged = $query->get();

        // lookup lists for form selects
        // include sort_order in response and prefer ordering by sort_order when present
        $inventoryItems = InventoryItem::with('category')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(function ($it) {
                return [
                    'id' => $it->id,
                    'name' => $it->name,
                    'category' => $it->category ? ['id' => $it->category->id, 'name' => $it->category->name] : null,
                    'sort_order' => property_exists($it, 'sort_order') ? $it->sort_order : null,
                ];
            });

        // return only active users ordered by id for predictable id-sorted lists
        // Users table has an enum `status` with values like 'active', 'retired', 'shared'
        $users = User::where('status', 'active')->orderBy('id')->get(['id', 'name']);
        $damageConditions = DamageCondition::orderBy('order_column')->get(['id', 'condition']);

        // ensure damaged_at is passed as the raw DB value (Y-m-d) to avoid timezone shifts on the client
        $damagedArr = $damaged->map(function ($d) {
            $arr = $d->toArray();
            $raw = $d->getRawOriginal('damaged_at') ?? null;
            $arr['damaged_at'] = $raw;
            return $arr;
        });

        return response()->json([
            'damaged' => $damagedArr,
            'inventory_items' => $inventoryItems,
            'users' => $users,
            'damage_conditions' => $damageConditions,
        ]);
    }

    public function store(Request $request)
    {
        $messages = [
            'inventory_item_id.required' => '在庫を選択してください。',
            'inventory_item_id.exists' => '選択した在庫が存在しません。',
            'handler_user_id.required' => '対応者を選択してください。',
            'handler_user_id.exists' => '選択したユーザーが存在しません。',
            'damaged_at.required' => '破損日を入力してください。',
            'damaged_at.date' => '有効な日付を指定してください。',
            'compensation_amount.integer' => '弁済金額は数値で入力してください。',
            'payment_method.in' => '支払い方法の選択が不正です。',
            'receipt_image.image' => 'レシートは画像ファイルを選択してください。',
            'receipt_image.max' => 'レシート画像は10MB以下にしてください。',
            'damaged_area_images.*.image' => '破損個所（写真）は画像ファイルを選択してください。',
            'damaged_area_images.*.max' => '破損個所（写真）は10MB以下にしてください。',
            'customer_id_image.image' => '顧客身分証は画像ファイルを選択してください。',
            'customer_id_image.max' => '顧客身分証画像は10MB以下にしてください。',
        ];

        $rules = [
            'inventory_item_id' => 'required|exists:inventory_items,id',
            'handler_user_id' => 'required|exists:users,id',
            'management_number' => 'nullable|string',
            'damaged_at' => 'required|date',
            'damage_condition_id' => 'nullable|exists:damage_conditions,id',
            'damaged_area' => 'nullable|string',
            'customer_name' => 'nullable|string',
            'customer_phone' => ['nullable', 'regex:/^[0-9\-\+\s()]{4,20}$/'],
            'customer_id_image' => 'nullable|image|max:10240',
            'compensation_amount' => 'nullable|numeric',
            'payment_method' => 'nullable|in:cash,card,paypay',
            'receipt_number' => 'nullable|string',
            'receipt_image' => 'nullable|image|max:10240',
            'damaged_area_images.*' => 'image|max:10240',
            'memo' => 'nullable|string',
        ];

        $data = $request->validate($rules, $messages);

        DB::beginTransaction();
        try {
            // handle receipt image upload
            if ($request->hasFile('receipt_image')) {
                $path = $request->file('receipt_image')->store('receipts', 'public');
                $data['receipt_image_path'] = $path;
            }

            // handle customer id image upload
            if ($request->hasFile('customer_id_image')) {
                $path = $request->file('customer_id_image')->store('customer_ids', 'public');
                $data['customer_id_image_path'] = $path;
            }

            $damaged = DamagedInventory::create($data);

            // handle damaged area images and persist to attachments table (morphMany)
            if ($request->hasFile('damaged_area_images')) {
                foreach ($request->file('damaged_area_images') as $file) {
                    // store file via AttachmentService (stores under attachments/ on public disk)
                    $path = $this->attachmentService->store($file);
                    $damaged->attachments()->create([
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                }
            }

            DB::commit();
            $dam = $damaged->load('attachments');
            $arr = $dam->toArray();
            $arr['damaged_at'] = $damaged->getRawOriginal('damaged_at') ?? null;
            return response()->json($arr, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create damaged inventory', 'error' => $e->getMessage()], 500);
        }
    }

    public function show(DamagedInventory $damagedInventory)
    {
        $d = $damagedInventory->load(['inventoryItem', 'handlerUser', 'damageCondition', 'attachments']);
        $arr = $d->toArray();
        $arr['damaged_at'] = $damagedInventory->getRawOriginal('damaged_at') ?? null;
        return response()->json($arr);
    }

    public function update(Request $request, DamagedInventory $damagedInventory)
    {
        $messages = [
            'inventory_item_id.required' => '在庫を選択してください。',
            'inventory_item_id.exists' => '選択した在庫が存在しません。',
            'handler_user_id.required' => '対応者を選択してください。',
            'handler_user_id.exists' => '選択したユーザーが存在しません。',
            'damaged_at.required' => '破損日を入力してください。',
            'damaged_at.date' => '有効な日付を指定してください。',
            'compensation_amount.integer' => '弁済金額は数値で入力してください。',
            'payment_method.in' => '支払い方法の選択が不正です。',
            'receipt_image.image' => 'レシートは画像ファイルを選択してください。',
            'receipt_image.max' => 'レシート画像は10MB以下にしてください。',
            'damaged_area_images.*.image' => '破損個所（写真）は画像ファイルを選択してください。',
            'damaged_area_images.*.max' => '破損個所（写真）は10MB以下にしてください。',
            'customer_id_image.image' => '顧客身分証は画像ファイルを選択してください。',
            'customer_id_image.max' => '顧客身分証画像は10MB以下にしてください。',
        ];

        $rules = [
            'inventory_item_id' => 'required|exists:inventory_items,id',
            'handler_user_id' => 'required|exists:users,id',
            'management_number' => 'nullable|string',
            'damaged_at' => 'required|date',
            'damage_condition_id' => 'nullable|exists:damage_conditions,id',
            'damaged_area' => 'nullable|string',
            'customer_name' => 'nullable|string',
            'customer_phone' => ['nullable', 'regex:/^[0-9\-\+\s()]{4,20}$/'],
            'compensation_amount' => 'nullable|numeric',
            'payment_method' => 'nullable|in:cash,card,paypay',
            'receipt_number' => 'nullable|string',
            'receipt_image' => 'nullable|image|max:10240',
            'damaged_area_images.*' => 'image|max:10240',
            'customer_id_image' => 'nullable|image|max:10240',
            'memo' => 'nullable|string',
        ];

        $data = $request->validate($rules, $messages);

        DB::beginTransaction();
        try {
            // handle receipt image upload (replace)
            if ($request->hasFile('receipt_image')) {
                $path = $request->file('receipt_image')->store('receipts', 'public');
                $data['receipt_image_path'] = $path;
            }

            // handle customer id image upload (replace)
            if ($request->hasFile('customer_id_image')) {
                $path = $request->file('customer_id_image')->store('customer_ids', 'public');
                $data['customer_id_image_path'] = $path;
            }

            // handle deletion of existing receipt if requested
            if ($request->input('remove_receipt')) {
                if ($damagedInventory->receipt_image_path) {
                    Storage::disk('public')->delete($damagedInventory->receipt_image_path);
                }
                $data['receipt_image_path'] = null;
            }

            // handle deletion of existing customer id image if requested
            if ($request->input('remove_customer_id')) {
                if ($damagedInventory->customer_id_image_path) {
                    Storage::disk('public')->delete($damagedInventory->customer_id_image_path);
                }
                $data['customer_id_image_path'] = null;
            }

            $damagedInventory->update($data);

            // handle new damaged area images and persist to attachments table (morphMany)
            if ($request->hasFile('damaged_area_images')) {
                foreach ($request->file('damaged_area_images') as $file) {
                    $path = $this->attachmentService->store($file);
                    $damagedInventory->attachments()->create([
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                }
            }

            // handle deletion of attachments requested
            $deleted = $request->input('deleted_attachment_ids', []);
            if (is_array($deleted) && count($deleted) > 0) {
                foreach ($deleted as $attId) {
                    $att = $damagedInventory->attachments()->where('id', $attId)->first();
                    if ($att) {
                        // delete file
                        Storage::disk('public')->delete($att->file_path);
                        $att->delete();
                    }
                }
            }

            DB::commit();
            $d = $damagedInventory->load('attachments');
            $arr = $d->toArray();
            $arr['damaged_at'] = $damagedInventory->getRawOriginal('damaged_at') ?? null;
            return response()->json($arr);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update damaged inventory', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy(DamagedInventory $damagedInventory)
    {
        $damagedInventory->delete();
        return response()->noContent();
    }

    // Server-side aggregated stats: month -> category -> name -> { condition: count }
    public function stats(Request $request)
    {
        // fetch necessary fields and join relations to avoid N+1
        $rows = DamagedInventory::with(['inventoryItem.category', 'damageCondition'])
            ->orderBy('damaged_at', 'desc')
            ->get()
            ->map(function ($d) {
                return [
                    'damaged_at' => $d->getRawOriginal('damaged_at'),
                    'category' => $d->inventoryItem && $d->inventoryItem->category ? $d->inventoryItem->category->name : null,
                    'name' => $d->inventoryItem ? $d->inventoryItem->name : null,
                    'management_number' => $d->management_number,
                    'condition' => $d->damageCondition ? $d->damageCondition->condition : null,
                ];
            });

        $map = [];
        foreach ($rows as $r) {
            $month = $r['damaged_at'] ? substr($r['damaged_at'], 0, 7) : '未知';
            $cat = $r['category'] ?? '未設定';
            $name = $r['name'] ?? ($r['management_number'] ? '管理番号:' . $r['management_number'] : '未設定');
            $cond = $r['condition'] ?? '未設定';

            if (!isset($map[$month])) $map[$month] = [];
            if (!isset($map[$month][$cat])) $map[$month][$cat] = [];
            if (!isset($map[$month][$cat][$name])) $map[$month][$cat][$name] = [];
            if (!isset($map[$month][$cat][$name][$cond])) $map[$month][$cat][$name][$cond] = 0;
            $map[$month][$cat][$name][$cond]++;
        }

        // Optionally, compute totals for convenience on client
        $out = [];
        foreach ($map as $month => $cats) {
            $monthTotal = 0;
            $catList = [];
            foreach ($cats as $catName => $names) {
                $catTotal = 0;
                $nameList = [];
                foreach ($names as $nm => $conds) {
                    $nt = array_sum(array_values($conds));
                    $nameList[$nm] = ['total' => $nt, 'conds' => $conds];
                    $catTotal += $nt;
                }
                $catList[$catName] = ['total' => $catTotal, 'names' => $nameList];
                $monthTotal += $catTotal;
            }
            $out[$month] = ['total' => $monthTotal, 'categories' => $catList];
        }

        return response()->json(['stats' => $out]);
    }
}
