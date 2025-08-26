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
        $damaged = DamagedInventory::with(['inventoryItem.category', 'handlerUser', 'damageCondition', 'attachments'])
            ->orderBy('damaged_at', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        // lookup lists for form selects
        $inventoryItems = InventoryItem::with('category')->orderBy('name')->get()->map(function ($it) {
            return [
                'id' => $it->id,
                'name' => $it->name,
                'category' => $it->category ? ['id' => $it->category->id, 'name' => $it->category->name] : null,
            ];
        });

        $users = User::orderBy('name')->get(['id', 'name']);
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
}
