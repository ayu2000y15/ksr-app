<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryCategory;
use App\Models\InventoryStock;
use App\Models\InventoryStockLog;
// Supplier master removed; using free-text supplier field on inventory_items
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class InventoryPageController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', \App\Models\InventoryItem::class);

        // include stocks so the Inertia index page receives per-item stock rows
        $items = InventoryItem::with(['category', 'stocks'])->orderBy('sort_order')->orderBy('name')->paginate(15);
        $categories = InventoryCategory::orderBy('order_column')->get();
        return Inertia::render('inventory/index', [
            'items' => $items,
            'categories' => $categories,
        ]);
    }

    public function create()
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $categories = InventoryCategory::orderBy('order_column')->get();
        // load existing items so the page can be used as an edit grid
        $items = InventoryItem::with(['stocks', 'category'])->orderBy('sort_order')->orderBy('name')->get();
        return Inertia::render('inventory/create', [
            'categories' => $categories,
            'items' => $items,
        ]);
    }

    /**
     * CSV一括登録
     * CSVフォーマット: 商品名,カテゴリ名,仕入先,カタログ名,サイズ,単位,保管場所,数量,メモ
     */
    public function importCsv(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $request->validate([
            'csv_file' => 'required|file|mimes:csv,txt|max:10240', // 10MB max
        ]);

        try {
            $file = $request->file('csv_file');
            $path = $file->getRealPath();

            // CSVファイルを読み込み
            $csv = array_map(function ($line) {
                return str_getcsv($line);
            }, file($path));

            // ヘッダー行をスキップ（存在する場合）
            $hasHeader = false;
            if (count($csv) > 0 && isset($csv[0][0])) {
                // 最初の行が「商品名」などのヘッダーかチェック
                if (in_array($csv[0][0], ['商品名', 'name', 'Name', '名前'])) {
                    $hasHeader = true;
                    array_shift($csv);
                }
            }

            $imported = 0;
            $errors = [];
            $categoryCache = []; // カテゴリ名→IDのキャッシュ

            DB::beginTransaction();

            foreach ($csv as $index => $row) {
                $lineNumber = $index + ($hasHeader ? 2 : 1); // 行番号（ヘッダー考慮）

                // 空行をスキップ
                if (empty($row) || !isset($row[0]) || trim($row[0]) === '') {
                    continue;
                }

                // 各列を取得（存在しない場合は空文字列）
                $name = isset($row[0]) ? trim($row[0]) : '';
                $categoryName = isset($row[1]) ? trim($row[1]) : '';
                $supplier = isset($row[2]) ? trim($row[2]) : '';
                $catalogName = isset($row[3]) ? trim($row[3]) : '';
                $size = isset($row[4]) ? trim($row[4]) : '';
                $unit = isset($row[5]) ? trim($row[5]) : '';
                $storageLocation = isset($row[6]) ? trim($row[6]) : '';
                $quantity = isset($row[7]) ? trim($row[7]) : '0';
                $memo = isset($row[8]) ? trim($row[8]) : '';

                // 商品名は必須
                if (empty($name)) {
                    $errors[] = "{$lineNumber}行目: 商品名が空です";
                    continue;
                }

                // カテゴリIDを取得（キャッシュ利用）
                $categoryId = null;
                if (!empty($categoryName)) {
                    if (isset($categoryCache[$categoryName])) {
                        $categoryId = $categoryCache[$categoryName];
                    } else {
                        $category = InventoryCategory::where('name', $categoryName)->first();
                        if ($category) {
                            $categoryId = $category->id;
                            $categoryCache[$categoryName] = $categoryId;
                        } else {
                            $errors[] = "{$lineNumber}行目: カテゴリ「{$categoryName}」が見つかりません";
                            continue;
                        }
                    }
                }

                // 既存アイテムを検索（商品名で）
                $item = InventoryItem::where('name', $name)->first();

                if (!$item) {
                    // 新規作成
                    $maxOrder = InventoryItem::max('sort_order') ?? 0;
                    $item = InventoryItem::create([
                        'name' => $name,
                        'category_id' => $categoryId,
                        'supplier_text' => $supplier,
                        'catalog_name' => $catalogName,
                        'size' => $size,
                        'unit' => $unit,
                        'memo' => $memo,
                        'sort_order' => $maxOrder + 1,
                    ]);
                } else {
                    // 既存アイテムを更新（空でない値のみ）
                    $updateData = [];
                    if ($categoryId !== null) $updateData['category_id'] = $categoryId;
                    if (!empty($supplier)) $updateData['supplier_text'] = $supplier;
                    if (!empty($catalogName)) $updateData['catalog_name'] = $catalogName;
                    if (!empty($size)) $updateData['size'] = $size;
                    if (!empty($unit)) $updateData['unit'] = $unit;
                    if (!empty($memo)) $updateData['memo'] = $memo;

                    if (!empty($updateData)) {
                        $item->update($updateData);
                    }
                }

                // 在庫情報の登録・更新
                if (!empty($storageLocation) || !empty($quantity)) {
                    $stock = InventoryStock::where('inventory_item_id', $item->id)
                        ->where('storage_location', $storageLocation ?: '未指定')
                        ->first();

                    $qty = is_numeric($quantity) ? (int)$quantity : 0;

                    if (!$stock) {
                        // 新規在庫作成
                        InventoryStock::create([
                            'inventory_item_id' => $item->id,
                            'storage_location' => $storageLocation ?: '未指定',
                            'quantity' => $qty,
                            'memo' => '',
                            'last_stocked_at' => now(),
                        ]);
                    } else {
                        // 既存在庫を更新（数量を加算ではなく上書き）
                        $oldQty = $stock->quantity;
                        $stock->update([
                            'quantity' => $qty,
                            'last_stocked_at' => now(),
                        ]);

                        // 在庫ログを記録
                        if ($oldQty != $qty) {
                            InventoryStockLog::create([
                                'inventory_item_id' => $item->id,
                                'storage_location' => $stock->storage_location,
                                'quantity_before' => $oldQty,
                                'quantity_after' => $qty,
                                'change_type' => 'csv_import',
                                'memo' => "CSV一括登録: {$oldQty} → {$qty}",
                                'changed_by' => auth()->id(),
                                'changed_at' => now(),
                            ]);
                        }
                    }
                }

                $imported++;
            }

            DB::commit();

            if (!empty($errors)) {
                return back()->with([
                    'message' => "{$imported}件のアイテムを登録しました。" . count($errors) . "件のエラーがあります。",
                    'errors' => $errors,
                    'type' => 'warning',
                ]);
            }

            return back()->with([
                'message' => "{$imported}件のアイテムをCSVから一括登録しました。",
                'type' => 'success',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->with([
                'message' => 'CSV登録中にエラーが発生しました: ' . $e->getMessage(),
                'type' => 'error',
            ]);
        }
    }
}
