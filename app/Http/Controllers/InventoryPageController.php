<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryCategory;
use App\Models\InventoryStock;
use App\Models\InventoryStockLog;
use App\Models\InventorySeason;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class InventoryPageController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', \App\Models\InventoryItem::class);

        // シーズンフィルタリング
        $seasonId        = $request->filled('season_id') ? intval($request->input('season_id')) : null;
        $compareSeasonId = $request->filled('compare_season_id') ? intval($request->input('compare_season_id')) : null;

        $seasons = InventorySeason::orderBy('name', 'desc')->get();

        // シーズン未指定の場合はアクティブシーズンをデフォルトに
        if ($seasonId === null) {
            $active = $seasons->firstWhere('is_active', true);
            if ($active) {
                $seasonId = $active->id;
            }
        }

        // items を読み込む（シーズン指定があればそのシーズンの stocks のみ）
        $items = InventoryItem::with([
            'category',
            'stocks' => function ($q) use ($seasonId) {
                if ($seasonId !== null) {
                    $q->where('season_id', $seasonId);
                }
                // シーズン未指定時は全 stocks を返す（従来動作）
            },
        ])->orderBy('sort_order')->orderBy('name')->get();

        // 比較モード用に指定シーズンの在庫を取得
        $compareItems = [];
        if ($compareSeasonId !== null) {
            $compareItems = InventoryItem::with([
                'stocks' => fn($q) => $q->where('season_id', $compareSeasonId),
            ])->orderBy('sort_order')->orderBy('name')->get();
        }

        $categories = InventoryCategory::orderBy('order_column')->get();
        return Inertia::render('inventory/index', [
            'items'            => $items,
            'categories'       => $categories,
            'seasons'          => $seasons,
            'currentSeasonId'  => $seasonId,
            'compareSeasonId'  => $compareSeasonId,
            'compareItems'     => $compareItems,
        ]);
    }

    public function create(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $seasons = InventorySeason::orderBy('name', 'desc')->get();

        // シーズンフィルタリング（一覧と同様）
        $seasonId = $request->filled('season_id') ? intval($request->input('season_id')) : null;
        if ($seasonId === null) {
            $active = $seasons->firstWhere('is_active', true);
            if ($active) {
                $seasonId = $active->id;
            }
        }

        $categories = InventoryCategory::orderBy('order_column')->get();
        // load existing items so the page can be used as an edit grid
        // シーズン指定がある場合はそのシーズンの stocks のみを返す
        $items = InventoryItem::with([
            'stocks' => function ($q) use ($seasonId) {
                if ($seasonId !== null) {
                    $q->where('season_id', $seasonId);
                }
            },
            'category',
        ])->orderBy('sort_order')->orderBy('name')->get();

        return Inertia::render('inventory/create', [
            'categories'      => $categories,
            'items'           => $items,
            'seasons'         => $seasons,
            'currentSeasonId' => $seasonId,
        ]);
    }

    /**
     * CSV一括登録
     * CSVフォーマット: 商品名,カテゴリ名,仕入先,カタログ名,サイズ,単位,保管場所,数量,メモ
     */
    public function importCsv(Request $request)
    {
        $this->authorize('create', \App\Models\InventoryItem::class);

        $validator = Validator::make($request->all(), [
            'csv_file' => 'required|file|mimes:csv,txt|max:10240', // 10MB max
        ], [
            'csv_file.required' => 'CSVファイルを選択してください',
            'csv_file.file' => '有効なファイルをアップロードしてください',
            'csv_file.mimes' => 'CSVファイル（.csv または .txt）をアップロードしてください',
            'csv_file.max' => 'ファイルサイズは10MB以下にしてください',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'ファイルのバリデーションに失敗しました',
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        try {
            $file = $request->file('csv_file');
            $path = $file->getRealPath();

            // 文字エンコーディングの検出と変換
            $content = file_get_contents($path);
            $encoding = mb_detect_encoding($content, ['UTF-8', 'SJIS', 'SJIS-win', 'EUC-JP', 'ASCII'], true);

            if ($encoding && $encoding !== 'UTF-8') {
                $content = mb_convert_encoding($content, 'UTF-8', $encoding);
                file_put_contents($path, $content);
            }

            // CSVファイルを読み込み
            $csv = array_map(function ($line) {
                return str_getcsv($line);
            }, file($path));

            if (empty($csv)) {
                return response()->json([
                    'success' => false,
                    'message' => 'CSVファイルが空です',
                    'errors' => ['CSVファイルにデータが含まれていません'],
                ], 422);
            }

            // 1行目はヘッダーとして常にスキップ
            $hasHeader = true;
            array_shift($csv);

            $imported = 0;
            $updated = 0;
            $errors = [];
            $warnings = [];
            $categoryCache = []; // カテゴリ名→IDのキャッシュ
            $seasonCache  = []; // シーズン名→IDのキャッシュ
            $itemOrderMap = []; // 商品名→CSV行順序（sort_order用）
            $itemOrderCounter = 0; // CSVに現れた商品のカウンター

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
                $seasonName = isset($row[9]) ? trim($row[9]) : '';

                // 商品名は必須
                if (empty($name)) {
                    $errors[] = "[{$lineNumber}行目] 商品名が入力されていません（必須項目です）";
                    continue;
                }

                // CSV上で初めて登場した順番を記録（保管場所違いの複数行は同じ順番）
                if (!isset($itemOrderMap[$name])) {
                    $itemOrderMap[$name] = ++$itemOrderCounter;
                }
                $csvSortOrder = $itemOrderMap[$name];

                // 商品名の長さチェック
                if (mb_strlen($name) > 255) {
                    $errors[] = "[{$lineNumber}行目] 商品名「{$name}」が長すぎます（255文字以内にしてください）";
                    continue;
                }

                // 数量の検証
                if (!empty($quantity) && !is_numeric($quantity)) {
                    $errors[] = "[{$lineNumber}行目] 商品「{$name}」の数量「{$quantity}」は数値ではありません（半角数字で入力してください）";
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
                            // 利用可能なカテゴリ一覧を取得
                            $availableCategories = InventoryCategory::orderBy('order_column')->pluck('name')->toArray();
                            $categoryList = implode('、', $availableCategories);
                            $errors[] = "[{$lineNumber}行目] 商品「{$name}」のカテゴリ「{$categoryName}」が見つかりません（利用可能なカテゴリ: {$categoryList}）";
                            continue;
                        }
                    }
                }

                // シーズンIDを取得（キャッシュ利用・存在しない場合は自動作成）
                $seasonId = null;
                if (!empty($seasonName)) {
                    if (isset($seasonCache[$seasonName])) {
                        $seasonId = $seasonCache[$seasonName];
                    } else {
                        // シーズン名の形式チェック（YYYY-YY）
                        if (!preg_match('/^\d{4}-\d{2}$/', $seasonName)) {
                            $errors[] = "[{$lineNumber}行目] シーズン「{$seasonName}」の形式が正しくありません（例: 2025-26）";
                            continue;
                        }
                        $season = \App\Models\InventorySeason::firstOrCreate(
                            ['name' => $seasonName],
                            ['is_active' => false]
                        );
                        $seasonId = $season->id;
                        $seasonCache[$seasonName] = $seasonId;
                    }
                }

                // 既存アイテムを検索（商品名で）
                $item = InventoryItem::where('name', $name)->first();

                if (!$item) {
                    // 新規作成（sort_orderはCSV行順序）
                    try {
                        $item = InventoryItem::create([
                            'name' => $name,
                            'category_id' => $categoryId,
                            'supplier_text' => $supplier,
                            'catalog_name' => $catalogName,
                            'size' => $size,
                            'unit' => $unit,
                            'memo' => $memo,
                            'sort_order' => $csvSortOrder,
                        ]);
                        $imported++;
                    } catch (\Exception $e) {
                        $errors[] = "[{$lineNumber}行目] 商品「{$name}」の登録に失敗しました: {$e->getMessage()}";
                        continue;
                    }
                } else {
                    // 既存アイテムを更新（sort_orderは常にCSV行順序で上書き）
                    $updateData = ['sort_order' => $csvSortOrder];
                    if ($categoryId !== null) $updateData['category_id'] = $categoryId;
                    if (!empty($supplier)) $updateData['supplier_text'] = $supplier;
                    if (!empty($catalogName)) $updateData['catalog_name'] = $catalogName;
                    if (!empty($size)) $updateData['size'] = $size;
                    if (!empty($unit)) $updateData['unit'] = $unit;
                    if (!empty($memo)) $updateData['memo'] = $memo;

                    try {
                        $item->update($updateData);
                        $updated++;
                    } catch (\Exception $e) {
                        $errors[] = "[{$lineNumber}行目] 商品「{$name}」の更新に失敗しました: {$e->getMessage()}";
                        continue;
                    }
                }

                // 在庫情報の登録・更新
                if (!empty($storageLocation) || !empty($quantity)) {
                    try {
                        // シーズン指定がある場合はシーズンでもスコープを絞る
                        $stockQuery = InventoryStock::where('inventory_item_id', $item->id)
                            ->where('storage_location', $storageLocation ?: '未指定');
                        if ($seasonId !== null) {
                            $stockQuery->where('season_id', $seasonId);
                        } else {
                            $stockQuery->whereNull('season_id');
                        }
                        $stock = $stockQuery->first();

                        $qty = is_numeric($quantity) ? (int)$quantity : 0;

                        if (!$stock) {
                            // 新規在庫作成
                            InventoryStock::create([
                                'inventory_item_id' => $item->id,
                                'storage_location' => $storageLocation ?: '未指定',
                                'quantity' => $qty,
                                'memo' => '',
                                'last_stocked_at' => now(),
                                'season_id' => $seasonId,
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
                                    'inventory_stock_id' => $stock->id,
                                    'user_id' => auth()->id(),
                                    'change_date' => now(),
                                    'quantity_before' => $oldQty,
                                    'quantity_after' => $qty,
                                    'reason' => "CSV一括登録: {$oldQty} → {$qty}",
                                ]);
                            }
                        }
                    } catch (\Exception $e) {
                        $warnings[] = "[{$lineNumber}行目] 商品「{$name}」の在庫情報の登録に失敗しました: {$e->getMessage()}";
                    }
                }
            }

            // 結果メッセージの作成
            $resultMessages = [];
            if ($imported > 0) {
                $resultMessages[] = "新規登録: {$imported}件";
            }
            if ($updated > 0) {
                $resultMessages[] = "更新: {$updated}件";
            }

            $successMessage = implode('、', $resultMessages);
            if (empty($successMessage)) {
                $successMessage = '処理対象のデータがありませんでした';
            }

            // エラーがある場合はロールバックして処理を中止
            if (!empty($errors)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => count($errors) . "件のエラーがあります。データは登録されていません。",
                    'errors' => $errors,
                    'warnings' => $warnings,
                ], 422);
            }

            // エラーがない場合のみコミット
            DB::commit();

            if (!empty($warnings)) {
                return response()->json([
                    'success' => true,
                    'message' => "CSV登録完了（{$successMessage}）ただし、" . count($warnings) . "件の警告があります",
                    'warnings' => $warnings,
                    'imported' => $imported,
                    'updated' => $updated,
                ], 200);
            }

            return response()->json([
                'success' => true,
                'message' => "CSV登録完了（{$successMessage}）",
                'imported' => $imported,
                'updated' => $updated,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            $errorDetail = $e->getMessage();
            $errorFile = basename($e->getFile());
            $errorLine = $e->getLine();

            return response()->json([
                'success' => false,
                'message' => 'CSV登録処理中に予期しないエラーが発生しました',
                'errors' => [
                    "エラー詳細: {$errorDetail}",
                    "発生場所: {$errorFile}:{$errorLine}",
                    'CSVファイルの形式が正しいか、文字コードがUTF-8またはShift_JISになっているかご確認ください',
                ],
            ], 500);
        }
    }

    /**
     * CSV一括エクスポート（アップロード形式と同じフォーマット）
     * CSVフォーマット: 商品名,カテゴリ名,仕入先,カタログ名,サイズ,単位,保管場所,数量,メモ
     */
    public function exportCsv(Request $request)
    {
        $this->authorize('viewAny', \App\Models\InventoryItem::class);

        $items = InventoryItem::with(['category', 'stocks.season'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $rows = [];
        // BOM for Excel UTF-8 compatibility
        $bom = "\xEF\xBB\xBF";

        $header = ['商品名', 'カテゴリ名', '仕入先', 'カタログ名', 'サイズ', '単位', '保管場所', '数量', 'メモ', 'シーズン'];

        foreach ($items as $item) {
            $stocks = $item->stocks;
            if ($stocks->isEmpty()) {
                $rows[] = [
                    $item->name,
                    $item->category?->name ?? '',
                    $item->supplier_text ?? '',
                    $item->catalog_name ?? '',
                    $item->size ?? '',
                    $item->unit ?? '',
                    '',
                    0,
                    $item->memo ?? '',
                    '',
                ];
            } else {
                // 保管場所名でソートして出力（「未指定」を末尾に）
                $sortedStocks = $stocks->sortBy(function ($stock) {
                    $loc = $stock->storage_location ?? '';
                    return $loc === '未指定' ? "\xFF" . $loc : $loc;
                });
                foreach ($sortedStocks as $stock) {
                    $rows[] = [
                        $item->name,
                        $item->category?->name ?? '',
                        $item->supplier_text ?? '',
                        $item->catalog_name ?? '',
                        $item->size ?? '',
                        $item->unit ?? '',
                        $stock->storage_location ?? '',
                        $stock->quantity ?? 0,
                        $item->memo ?? '',
                        $stock->season?->name ?? '',
                    ];
                }
            }
        }

        $callback = function () use ($bom, $header, $rows) {
            $handle = fopen('php://output', 'w');
            // BOM書き込み
            fwrite($handle, $bom);
            fputcsv($handle, $header);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        };

        $filename = '在庫データ_' . now()->format('Ymd_His') . '.csv';

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . rawurlencode($filename) . '"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
