import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, Download, Plus, Settings, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

export default function Index({
    items: initial,
    seasons: initialSeasons = [],
    currentSeasonId: initialSeasonId = null,
    compareSeasonId: initialCompareSeasonId = null,
    compareItems: initialCompareItems = [],
}: any) {
    const page = usePage();
    const inventoryPerms = ((page.props as any)?.permissions || {}).inventory || {
        view: false,
        create: false,
        update: false,
        delete: false,
        logs: false,
    };
    const [items, setItems] = useState(initial || []);
    useEffect(() => setItems(initial || []), [initial]);

    // シーズン管理
    const [seasons, setSeasons] = useState<any[]>(initialSeasons || []);
    const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(initialSeasonId ?? null);
    const [compareSeasonId, setCompareSeasonId] = useState<number | null>(initialCompareSeasonId ?? null);
    const [compareItems, setCompareItems] = useState<any[]>(initialCompareItems || []);
    const [showCompare, setShowCompare] = useState<boolean>(initialCompareSeasonId !== null);
    const [showSeasonDialog, setShowSeasonDialog] = useState(false);
    const [newSeasonName, setNewSeasonName] = useState('');
    const [newSeasonNote, setNewSeasonNote] = useState('');
    const [seasonSaving, setSeasonSaving] = useState(false);
    const [seasonError, setSeasonError] = useState<string | null>(null);

    useEffect(() => {
        setSeasons(initialSeasons || []);
        setCurrentSeasonId(initialSeasonId ?? null);
        setCompareSeasonId(initialCompareSeasonId ?? null);
        setCompareItems(initialCompareItems || []);
        setShowCompare(initialCompareSeasonId !== null);
    }, [initialSeasons, initialSeasonId, initialCompareSeasonId, initialCompareItems]);

    // 前シーズン在庫マップ: item_id -> { location -> qty }
    const prevStocksMap: Record<number, Record<string, number>> = {};
    (compareItems || []).forEach((item: any) => {
        prevStocksMap[item.id] = {};
        (item.stocks || []).forEach((st: any) => {
            const loc = (st.storage_location || '未指定').toString().trim() || '未指定';
            prevStocksMap[item.id][loc] = Number(st.quantity) || 0;
        });
    });

    const handleSeasonChange = (value: string) => {
        const params: Record<string, string> = {};
        if (value) params.season_id = value;
        // 比較シーズンはリセット
        router.get(route('inventory.index'), params, { preserveScroll: false });
    };

    const handleCompareToggle = () => {
        const next = !showCompare;
        setShowCompare(next);
        if (!next) {
            // 比較解除: compare_season_id なしで再ナビ
            const params: Record<string, string> = {};
            if (currentSeasonId) params.season_id = String(currentSeasonId);
            router.get(route('inventory.index'), params, { preserveScroll: false });
        }
        // ON にしたときはドロップダウンが表示されるだけで即ナビしない
    };

    const handleCompareSeasonChange = (value: string) => {
        const params: Record<string, string> = {};
        if (currentSeasonId) params.season_id = String(currentSeasonId);
        if (value) params.compare_season_id = value;
        router.get(route('inventory.index'), params, { preserveScroll: false });
    };

    const handleAddSeason = async () => {
        if (!newSeasonName.trim()) {
            setSeasonError('シーズン名を入力してください');
            return;
        }
        setSeasonSaving(true);
        setSeasonError(null);
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch('/api/inventory-seasons', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ name: newSeasonName.trim(), note: newSeasonNote.trim() || null }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.errors?.name?.[0] || data?.message || '登録に失敗しました';
                setSeasonError(msg);
                return;
            }
            setSeasons((prev) => [data, ...prev].sort((a, b) => b.name.localeCompare(a.name)));
            setNewSeasonName('');
            setNewSeasonNote('');
        } finally {
            setSeasonSaving(false);
        }
    };

    const handleDeleteSeason = async (id: number) => {
        if (!confirm('このシーズンを削除しますか？')) return;
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        const res = await fetch(`/api/inventory-seasons/${id}`, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data?.message || '削除に失敗しました');
            return;
        }
        setSeasons((prev) => prev.filter((s) => s.id !== id));
        if (currentSeasonId === id) {
            router.get(route('inventory.index'));
        }
    };

    const handleSetActive = async (id: number) => {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        const res = await fetch(`/api/inventory-seasons/${id}/set-active`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        });
        if (!res.ok) {
            alert('アクティブ設定に失敗しました');
            return;
        }
        setSeasons((prev) => prev.map((s) => ({ ...s, is_active: s.id === id })));
    };

    // CSV アップロード関連
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ファイル拡張子チェック
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
            setToast({ message: 'CSVファイル（.csv または .txt）を選択してください', type: 'error' });
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('csv_file', file);

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(route('inventory.import_csv'), {
                method: 'POST',
                body: formData,
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            });

            const data = await res.json().catch(() => ({ success: false, message: 'サーバーからの応答が不正です' }));

            if (!res.ok || !data.success) {
                // エラーメッセージの構築
                const errors = data.errors && Array.isArray(data.errors) ? data.errors : [];
                const warnings = data.warnings && Array.isArray(data.warnings) ? data.warnings : [];

                // エラーが多い場合はダイアログで表示
                if (errors.length > 3 || warnings.length > 0) {
                    setCsvErrorDialog({
                        open: true,
                        title: data.message || 'CSVアップロードエラー',
                        errors,
                        warnings,
                    });
                } else {
                    // エラーが少ない場合はトーストで表示
                    let errorMessage = data.message || 'CSVアップロードに失敗しました';
                    if (errors.length > 0) {
                        errorMessage += '\n\n' + errors.join('\n');
                    }
                    setToast({ message: errorMessage, type: 'error' });
                }
                return;
            }

            // 成功時
            let successMessage = data.message || 'CSV登録が完了しました';

            if (data.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
                successMessage += '\n\n【警告】\n' + data.warnings.join('\n');
                setToast({ message: successMessage, type: 'info' });
            } else {
                setToast({ message: successMessage, type: 'success' });
            }

            // 成功したらページをリロード（少し遅延させてトーストを表示）
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err) {
            console.error(err);
            setToast({
                message: 'CSVアップロード中に予期しないエラーが発生しました。\n\nネットワーク接続を確認してください。',
                type: 'error',
            });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const onRowClick = (it: any) => {
        window.location.href = route('inventory.show', it.id) as unknown as string;
    };

    const onEdit = (e: MouseEvent, it: any) => {
        e.stopPropagation();
        window.location.href = route('inventory.edit', it.id) as unknown as string;
    };

    const onDelete = async (e: MouseEvent, it: any) => {
        e.stopPropagation();
        if (!confirm('在庫を削除します。よろしいですか？')) return;
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(`/api/inventory/${it.id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('削除失敗');
            setItems((prev) => prev.filter((p: any) => p.id !== it.id));
        } catch (err) {
            console.error(err);
            alert('削除に失敗しました');
        }
    };

    // editing state: which category is in edit mode and edited rows per category
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    type EditedBucket = { locs: string[]; rows: any[] };
    const [editedData, setEditedData] = useState<Record<string, EditedBucket>>({});
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
    // collapsed state per category for mobile accordion (default: closed)
    const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
    // CSV説明の展開状態
    const [csvHelpExpanded, setCsvHelpExpanded] = useState(false);
    // CSVエラーダイアログ
    const [csvErrorDialog, setCsvErrorDialog] = useState<{ open: boolean; title: string; errors: string[]; warnings?: string[] }>({
        open: false,
        title: '',
        errors: [],
        warnings: [],
    });

    const toggleCollapse = (key: string) => {
        setCollapsedCats((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // helper: build locs and rows for a category (same logic as rendering)
    const buildCategoryRows = (cat: any) => {
        const locSet = new Set<string>();
        cat.items.forEach((it: any) => {
            const stocks = it.stocks && Array.isArray(it.stocks) && it.stocks.length > 0 ? it.stocks : [{ storage_location: '未指定', quantity: 0 }];
            stocks.forEach((st: any) => {
                const loc = (st.storage_location || '未指定').toString().trim();
                locSet.add(loc || '未指定');
            });
        });
        const locs = Array.from(locSet).sort((a, b) => {
            if (a === '未指定') return 1;
            if (b === '未指定') return -1;
            return a.localeCompare(b, 'ja');
        });
        const itemMap: Record<string, any> = {};
        cat.items.forEach((it: any) => {
            const key = it.id ? `id-${it.id}` : `${it.name}-${it.catalog_name}-${it.size}`;
            if (!itemMap[key]) {
                itemMap[key] = {
                    id: it.id,
                    name: it.name,
                    catalog_name: it.catalog_name,
                    size_with_unit: `${it.size || ''}${it.unit ? String(it.unit) : ''}`,
                    quantities: {},
                };
                locs.forEach((l) => (itemMap[key].quantities[l] = 0));
            }
            const stocks = it.stocks && Array.isArray(it.stocks) && it.stocks.length > 0 ? it.stocks : [{ storage_location: '未指定', quantity: 0 }];
            stocks.forEach((st: any) => {
                const loc = (st.storage_location || '未指定').toString().trim() || '未指定';
                const qty = Number(st.quantity) || 0;
                if (typeof itemMap[key].quantities[loc] === 'undefined') itemMap[key].quantities[loc] = qty;
                else itemMap[key].quantities[loc] += qty;
            });
        });
        const rows: any[] = Object.keys(itemMap).map((k) => itemMap[k]);
        return { locs, rows };
    };

    // map server field keys to Japanese labels for friendlier error messages
    const labelForField = (field: string) => {
        const parts = String(field).split('.');
        const last = parts[parts.length - 1];
        if (parts.includes('stocks')) {
            if (last === 'storage_location') return '場所';
            if (last === 'quantity') return '数量';
            if (last === 'memo') return '在庫メモ';
        }
        const map: Record<string, string> = {
            name: '名称',
            category_id: 'カテゴリ',
            catalog_name: 'カタログ名',
            size: 'サイズ',
            unit: '単位',
            supplier_text: '仕入れ先',
            memo: 'メモ',
        };
        return map[last] || last;
    };

    // when an input in a category blurs, detect whether focus left the whole category; if so, save edits for that category
    const handleCategoryInputBlur = (cat: any) => {
        const catKey = cat.id ? String(cat.id) : 'uncategorized';
        setTimeout(() => {
            const container = document.querySelector(`[data-cat-key="${catKey}"]`);
            const active = document.activeElement as HTMLElement | null;
            if (!container || !active) {
                // no container or no active element -> save
                saveEdits(cat);
                return;
            }
            if (!container.contains(active)) {
                saveEdits(cat);
            }
        }, 80);
    };

    const enterEdit = (cat: any) => {
        const catKey = cat.id ? String(cat.id) : 'uncategorized';
        const { locs, rows } = buildCategoryRows(cat);
        // store deep copy of rows so editing won't affect original
        const copy = rows.map((r) => ({ ...r, quantities: { ...r.quantities } }));
        setEditedData((prev) => ({ ...prev, [catKey]: { locs, rows: copy } }));
        setEditingCategory(catKey);
    };

    const cancelEdit = () => {
        setEditingCategory(null);
    };

    // value may be string (raw input) or number; allow empty string so user can clear input
    const updateQty = (catKey: string, rowIdx: number, loc: string, value: string | number) => {
        let val: string | number = value;
        if (typeof value === 'string') {
            // allow empty string; otherwise parse to non-negative integer
            if (value === '') {
                val = '';
            } else {
                const n = Number(value);
                val = Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
            }
        } else {
            const n = Number(value);
            val = Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
        }
        setEditedData((prev) => {
            const next = { ...prev };
            const bucket = next[catKey];
            if (!bucket) return prev;
            bucket.rows[rowIdx].quantities[loc] = val;
            return next;
        });
    };

    const saveEdits = async (cat: any) => {
        const catKey = cat.id ? String(cat.id) : 'uncategorized';
        const bucket = editedData[catKey];
        if (!bucket) return;
        const rows = bucket.rows as any[];
        if (!rows || rows.length === 0) {
            return;
        }
        try {
            const form = new FormData();
            // シーズンIDをフォームに含める
            if (currentSeasonId) {
                form.append('season_id', String(currentSeasonId));
            }
            // Only send item id and stocks to avoid touching other fields (like sort_order)
            rows.forEach((r, i) => {
                if (!r.id) return; // skip unsaved items
                form.append(`items[${i}][id]`, String(r.id));
                // include minimal required keys so server-side validation passes (name and category_id)
                const orig = items.find((it: any) => it.id === r.id);
                if (orig) {
                    form.append(`items[${i}][name]`, orig.name || '');
                    const catId = orig.category_id ?? (orig.category && orig.category.id) ?? '';
                    form.append(`items[${i}][category_id]`, String(catId));
                }
                // append only stocks per location; server should merge stocks and leave other item fields untouched
                let si = 0;
                Object.keys(r.quantities).forEach((loc) => {
                    form.append(`items[${i}][stocks][${si}][storage_location]`, loc);
                    form.append(`items[${i}][stocks][${si}][quantity]`, String(Number(r.quantities[loc] || 0)));
                    si++;
                });
            });
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch('/api/inventory', {
                method: 'POST',
                body: form,
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            });
            if (!res.ok) {
                // try to parse validation errors
                if (res.status === 422) {
                    const payload = await res.json();
                    const errs = payload.errors || {};
                    // collect all messages only (server already returns messages in Japanese)
                    const messages: string[] = [];
                    Object.values(errs).forEach((arr) => {
                        if (!Array.isArray(arr)) return;
                        arr.forEach((m) => {
                            if (typeof m === 'string') messages.push(m);
                        });
                    });
                    // dedupe
                    const uniq = Array.from(new Set(messages));
                    const message = uniq.length > 0 ? uniq.join('\n') : '入力エラーが発生しました';
                    setToast({ message: `保存に失敗しました:\n${message}`, type: 'error' });
                    return;
                }
                const txt = await res.text();
                setToast({ message: `保存に失敗しました: ${txt.slice(0, 200)}`, type: 'error' });
                return;
            }

            const payload = await res.json().catch(() => null);
            // Update local items state from editedData for this category
            setItems((prev) => {
                const copy = [...prev];
                // find indices of items belonging to this category in prev and update their quantities
                const idsInCategory = cat.items.map((it: any) => it.id).filter(Boolean);
                rows.forEach((r) => {
                    if (!r.id) return;
                    // find item by id in copy
                    const idx = copy.findIndex((it: any) => it.id === r.id);
                    if (idx === -1) return;
                    // update stocks: build stocks array from quantities
                    const newStocks = Object.keys(r.quantities).map((loc) => ({ storage_location: loc, quantity: Number(r.quantities[loc] || 0) }));
                    copy[idx] = { ...copy[idx], stocks: newStocks };
                });
                return copy;
            });

            setToast({ message: '保存しました', type: 'success' });
        } catch (e) {
            console.error(e);
            setToast({ message: '保存に失敗しました', type: 'error' });
        }
    };

    // Group items by category
    const categoriesMap: Record<string, { id: number | null; name: string; items: any[] }> = {};
    items.forEach((it: any) => {
        const catId = it.category?.id ? String(it.category.id) : 'uncategorized';
        if (!categoriesMap[catId]) categoriesMap[catId] = { id: it.category?.id || null, name: it.category?.name || '未分類', items: [] };
        categoriesMap[catId].items.push(it);
    });

    const categories = Object.values(categoriesMap);
    // initialize collapsed map when items change.
    // Preserve any existing user toggles; only add new categories as collapsed by default.
    useEffect(() => {
        setCollapsedCats((prev) => {
            const next: Record<string, boolean> = { ...prev };
            categories.forEach((c) => {
                const k = c.id ? String(c.id) : 'uncategorized';
                if (!(k in next)) next[k] = true; // default collapsed for new categories
            });
            // Optionally remove keys that no longer exist to keep state small
            Object.keys(next).forEach((key) => {
                if (!categories.some((c) => (c.id ? String(c.id) : 'uncategorized') === key)) {
                    delete next[key];
                }
            });
            return next;
        });
    }, [items]);
    // ensure items within each category are sorted by sort_order then name
    categories.forEach((cat) => {
        cat.items.sort((a: any, b: any) => {
            const sa = typeof a.sort_order !== 'undefined' && a.sort_order !== null ? Number(a.sort_order) : 0;
            const sb = typeof b.sort_order !== 'undefined' && b.sort_order !== null ? Number(b.sort_order) : 0;
            if (sa !== sb) return sa - sb;
            const an = (a.name || '').toString();
            const bn = (b.name || '').toString();
            return an.localeCompare(bn, 'ja');
        });
    });

    return (
        <AppSidebarLayout breadcrumbs={[{ title: '在庫管理', href: route('inventory.index') }]}>
            <Head title="在庫管理" />
            <div className="p-4 sm:p-6 lg:p-8">
                {/* メッセージ表示エリア（CSV登録の成功・エラー） */}
                {toast && (
                    <div className="mb-4 duration-300 animate-in fade-in slide-in-from-top-2">
                        <div
                            className={`rounded-md p-4 ${
                                toast.type === 'success'
                                    ? 'border border-green-200 bg-green-50 text-green-800'
                                    : toast.type === 'error'
                                      ? 'border border-red-200 bg-red-50 text-red-800'
                                      : 'border border-blue-200 bg-blue-50 text-blue-800'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    {toast.type === 'success' ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : toast.type === 'error' ? (
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-blue-500" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium whitespace-pre-line">{toast.message}</div>
                                </div>
                                <button
                                    onClick={() => setToast(null)}
                                    className="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-black/5"
                                    aria-label="閉じる"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CSV一括登録の説明 */}
                {inventoryPerms.create && (
                    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50">
                        <button
                            type="button"
                            onClick={() => setCsvHelpExpanded(!csvHelpExpanded)}
                            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-blue-100"
                        >
                            <h3 className="text-sm font-semibold text-blue-900">CSV一括登録について</h3>
                            <ChevronDown className={`h-4 w-4 text-blue-900 transition-transform ${csvHelpExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {csvHelpExpanded && (
                            <div className="border-t border-blue-200 p-4 pt-3">
                                <p className="mb-2 text-sm text-blue-800">
                                    CSVファイルから在庫を一括登録できます。以下の形式でCSVを作成してください：
                                </p>
                                <div className="mb-2 overflow-x-auto">
                                    <code className="block rounded bg-white p-2 text-xs whitespace-nowrap">
                                        商品名,カテゴリ名,仕入先,カタログ名,サイズ,単位,保管場所,数量,メモ,シーズン
                                    </code>
                                </div>
                                <ul className="mb-2 list-inside list-disc space-y-1 text-sm text-blue-800">
                                    <li>商品名は必須です</li>
                                    <li>カテゴリ名は事前に登録されている名前と完全一致する必要があります</li>
                                    <li>同じ商品名が既に存在する場合は、情報が更新されます</li>
                                    <li>数量は指定された保管場所の在庫数として上書きされます</li>
                                    <li>
                                        シーズンは <strong>YYYY-YY</strong> 形式で入力します（例:
                                        2025-26）。未登録の場合は自動作成されます。省略した場合はシーズンなしとして登録されます
                                    </li>
                                </ul>
                                <a href="/inventory_sample.csv" download className="text-sm font-medium text-blue-600 hover:underline">
                                    サンプルCSVをダウンロード
                                </a>
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <HeadingSmall title="在庫管理" description="カテゴリごとに在庫を表示" />
                        {/* シーズン選択 */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">シーズン</label>
                            <select
                                value={currentSeasonId ?? ''}
                                onChange={(e) => handleSeasonChange(e.target.value)}
                                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                            >
                                <option value="">全シーズン（従来表示）</option>
                                {seasons.map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                        {s.is_active ? ' ★' : ''}
                                    </option>
                                ))}
                            </select>
                            {currentSeasonId && seasons.length >= 2 && (
                                <label className="flex cursor-pointer items-center gap-1 text-sm text-gray-600">
                                    <input type="checkbox" checked={showCompare} onChange={handleCompareToggle} className="rounded" />
                                    前シーズンと比較
                                </label>
                            )}
                            {showCompare && currentSeasonId && (
                                <select
                                    value={compareSeasonId ?? ''}
                                    onChange={(e) => handleCompareSeasonChange(e.target.value)}
                                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="">比較シーズンを選択</option>
                                    {seasons
                                        .filter((s: any) => s.id !== currentSeasonId)
                                        .map((s: any) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}{s.is_active ? ' ★' : ''}
                                            </option>
                                        ))}
                                </select>
                            )}
                            {inventoryPerms.update && (
                                <button
                                    type="button"
                                    onClick={() => setShowSeasonDialog(true)}
                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
                                >
                                    <Settings className="h-3.5 w-3.5" />
                                    シーズン管理
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-start gap-2 sm:justify-end">
                        {/* CSV一括登録 */}
                        {inventoryPerms.create && (
                            <>
                                <input type="file" ref={fileInputRef} accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="whitespace-nowrap"
                                >
                                    <Upload className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">{uploading ? 'アップロード中...' : 'CSV一括登録'}</span>
                                </Button>
                            </>
                        )}
                        {/* CSVダウンロード */}
                        {inventoryPerms.view && (
                            <a href={route('inventory.export_csv')} download>
                                <Button size="sm" variant="outline" className="whitespace-nowrap">
                                    <Download className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">CSVダウンロード</span>
                                </Button>
                            </a>
                        )}
                        {/* 在庫ログ: show if user can view logs */}
                        {inventoryPerms.logs && (
                            <Link href={route('inventory.stock_logs.index')}>
                                <Button size="sm" variant="ghost" className="whitespace-nowrap">
                                    在庫ログ
                                </Button>
                            </Link>
                        )}

                        {/* カテゴリ編集: show if user can update inventory categories (use inventory.update as proxy) */}
                        {inventoryPerms.update && (
                            <Link href={route('inventory.categories.index')}>
                                <Button size="sm" variant="ghost" className="whitespace-nowrap">
                                    カテゴリ編集
                                </Button>
                            </Link>
                        )}
                        {/* 一括編集: show if user can create/update inventory */}
                        {(inventoryPerms.create || inventoryPerms.update) && (
                            <Link href={route('inventory.create')}>
                                <Button className="whitespace-nowrap">
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    {/* モバイルはアイコンのみ、sm以上でテキスト表示 */}
                                    <span className="hidden sm:inline">一括編集</span>
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {categories.map((cat) => {
                        const catKey = cat.id ? String(cat.id) : 'uncategorized';
                        return (
                            <Card key={`cat-${cat.id}-${cat.name}`}>
                                <CardHeader className="flex-row items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {/* Mobile-only accordion toggle (icon) placed left of title */}
                                        <button
                                            type="button"
                                            className="p-1 md:hidden"
                                            onClick={() => toggleCollapse(catKey)}
                                            aria-label={collapsedCats[catKey] ? '開く' : '閉じる'}
                                        >
                                            {collapsedCats[catKey] ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        <CardTitle>
                                            {cat.name}
                                            <div className="text-sm text-gray-500">{cat.items.length} 件</div>
                                        </CardTitle>
                                    </div>
                                    {editingCategory === catKey ? (
                                        <>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>
                                                編集モード解除
                                            </Button>
                                        </>
                                    ) : (
                                        <Button size="sm" onClick={() => enterEdit(cat)}>
                                            編集
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {/* cross-tab: columns = 固定(名称, カタログ名, サイズ+単位) + dynamic storage locations */}
                                    {(() => {
                                        // collect normalized locations for this category
                                        const locSet = new Set<string>();
                                        cat.items.forEach((it: any) => {
                                            const stocks =
                                                it.stocks && Array.isArray(it.stocks) && it.stocks.length > 0
                                                    ? it.stocks
                                                    : [{ storage_location: '未指定', quantity: 0 }];
                                            stocks.forEach((st: any) => {
                                                const loc = (st.storage_location || '未指定').toString().trim();
                                                locSet.add(loc || '未指定');
                                            });
                                        });

                                        // sort locations: alphabetically but put '未指定' at the end
                                        const locs = Array.from(locSet).sort((a, b) => {
                                            if (a === '未指定') return 1;
                                            if (b === '未指定') return -1;
                                            return a.localeCompare(b, 'ja');
                                        });
                                        if (locs.length === 0) return <div className="text-sm text-gray-500">表示する在庫がありません。</div>;

                                        // build rows keyed by item id - 各アイテムを個別に表示
                                        const itemMap: Record<string, any> = {};
                                        cat.items.forEach((it: any) => {
                                            // 各アイテムを個別のキーで管理（アイテムIDが必ずユニーク）
                                            const key = it.id ? `id-${it.id}` : `temp-${it.name}-${it.catalog_name}-${it.size}-${Math.random()}`;
                                            itemMap[key] = {
                                                id: it.id,
                                                name: it.name,
                                                catalog_name: it.catalog_name,
                                                size_with_unit: `${it.size || ''}${it.unit ? String(it.unit) : ''}`,
                                                quantities: {},
                                            };
                                            // initialize quantities for each loc
                                            locs.forEach((l) => (itemMap[key].quantities[l] = 0));

                                            // このアイテムの在庫情報を設定
                                            const stocks =
                                                it.stocks && Array.isArray(it.stocks) && it.stocks.length > 0
                                                    ? it.stocks
                                                    : [{ storage_location: '未指定', quantity: 0 }];
                                            stocks.forEach((st: any) => {
                                                const loc = (st.storage_location || '未指定').toString().trim() || '未指定';
                                                const qty = Number(st.quantity) || 0;
                                                itemMap[key].quantities[loc] = qty;
                                            });
                                        });

                                        const rows: any[] = Object.keys(itemMap).map((k) => itemMap[k]);

                                        return (
                                            <div>
                                                {/* mobile: stacked cards (no horizontal scroll) */}
                                                {!collapsedCats[catKey] && (
                                                    <div className="space-y-3 md:hidden">
                                                        {rows.map((r: any, ri: number) => (
                                                            <div key={`m-item-${r.id || r.name}`} className="rounded border bg-white p-3">
                                                                <div className="flex items-start justify-between">
                                                                    <div>
                                                                        <div className="font-medium">{r.name}</div>
                                                                        <div className="text-sm text-gray-600">{r.catalog_name || '-'}</div>
                                                                        <div className="text-sm text-gray-600">{r.size_with_unit || '-'}</div>
                                                                    </div>
                                                                    <div className="text-left text-sm font-medium">
                                                                        {Object.values(r.quantities).reduce(
                                                                            (s: number, v: any) => s + (Number(v) || 0),
                                                                            0,
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-1 bg-gray-200 p-2 text-sm">
                                                                    {locs.map((l) => {
                                                                        const qty = Number(r.quantities[l] ?? 0) || 0;
                                                                        const catKey = cat.id ? String(cat.id) : 'uncategorized';
                                                                        const editing = editingCategory === catKey;
                                                                        const editedBucket = editedData[catKey];
                                                                        const editedVal = editedBucket ? editedBucket.rows[ri].quantities[l] : qty;
                                                                        return (
                                                                            <div
                                                                                key={`m-${r.id}-${l}`}
                                                                                className="flex justify-between border-b border-gray-300 py-2"
                                                                            >
                                                                                <span className="truncate text-gray-600">{l}</span>
                                                                                {editing ? (
                                                                                    <input
                                                                                        type="number"
                                                                                        value={editedVal ?? ''}
                                                                                        onChange={(e) => updateQty(catKey, ri, l, e.target.value)}
                                                                                        onFocus={(e) => (e.target as HTMLInputElement).select()}
                                                                                        onBlur={() => handleCategoryInputBlur(cat)}
                                                                                        className="h-12 w-20 py-2 text-right text-sm md:h-10 md:w-14"
                                                                                        inputMode="numeric"
                                                                                        pattern="[0-9]*"
                                                                                        autoComplete="off"
                                                                                        min={0}
                                                                                        step={1}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === '-' || e.key === '+') e.preventDefault();
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <span
                                                                                        className={
                                                                                            qty === 0 ? 'text-gray-400' : 'font-medium text-sky-600'
                                                                                        }
                                                                                    >
                                                                                        {qty === 0 ? '-' : qty}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="hidden overflow-x-auto md:block">
                                                    <table className="w-full table-fixed border-collapse text-sm">
                                                        {/* colgroup: first columns fixed, dynamic location columns fixed width, total fixed */}
                                                        <colgroup>
                                                            <col style={{ width: '160px' }} />
                                                            <col style={{ width: '100px' }} />
                                                            <col style={{ width: '80px' }} />
                                                            {locs.map((loc) => (
                                                                <col key={`col-${loc}`} style={{ width: '60px', minWidth: '50px' }} />
                                                            ))}
                                                            <col style={{ width: '60px' }} />
                                                        </colgroup>
                                                        <thead>
                                                            <tr className="text-left">
                                                                <th className="px-2 py-2">名称</th>
                                                                <th className="px-2 py-2">カタログ名</th>
                                                                <th className="px-2 py-2">サイズ</th>
                                                                {locs.map((l) => (
                                                                    <th key={`h-${l}`} className="px-2 py-2">
                                                                        <div className="w-full truncate" title={l}>
                                                                            {l}
                                                                        </div>
                                                                        {showCompare && (
                                                                            <div className="text-xs font-normal text-gray-400">今 / 前</div>
                                                                        )}
                                                                    </th>
                                                                ))}
                                                                <th className="px-2 py-2">合計</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rows.map((r: any, ri: number) => (
                                                                <tr key={`item-${r.id || r.name}`} className="border-t">
                                                                    <td className="px-2 py-2">{r.name}</td>
                                                                    <td className="px-2 py-2 text-gray-600">{r.catalog_name || '-'}</td>
                                                                    <td className="px-2 py-2 text-gray-600">{r.size_with_unit || '-'}</td>
                                                                    {locs.map((l) => {
                                                                        const qty = Number(r.quantities[l] ?? 0) || 0;
                                                                        const catKey = cat.id ? String(cat.id) : 'uncategorized';
                                                                        const editing = editingCategory === catKey;
                                                                        const editedBucket = editedData[catKey];
                                                                        const editedVal = editedBucket ? editedBucket.rows[ri].quantities[l] : qty;
                                                                        const prevQty =
                                                                            showCompare && r.id && prevStocksMap[r.id] !== undefined
                                                                                ? (prevStocksMap[r.id][l] ?? 0)
                                                                                : null;
                                                                        return (
                                                                            <td key={`${r.id}-${l}`} className="px-2 py-2 text-left">
                                                                                {editing ? (
                                                                                    <input
                                                                                        type="number"
                                                                                        value={editedVal ?? ''}
                                                                                        onChange={(e) => updateQty(catKey, ri, l, e.target.value)}
                                                                                        onBlur={() => handleCategoryInputBlur(cat)}
                                                                                        className="h-10 w-20 py-2 text-left text-sm"
                                                                                        inputMode="numeric"
                                                                                        min={0}
                                                                                        step={1}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === '-' || e.key === '+') e.preventDefault();
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <span className="inline-flex items-baseline gap-1">
                                                                                        {qty === 0 ? (
                                                                                            <span className="text-gray-400">-</span>
                                                                                        ) : (
                                                                                            <span className="font-medium text-sky-600">{qty}</span>
                                                                                        )}
                                                                                        {prevQty !== null && (
                                                                                            <span className="text-xs text-gray-400 tabular-nums">
                                                                                                ({prevQty === 0 ? '-' : prevQty})
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="px-2 py-2 text-left font-medium text-indigo-700">
                                                                        {(() => {
                                                                            const total = Object.values(r.quantities).reduce(
                                                                                (s: number, v: any) => s + (Number(v) || 0),
                                                                                0,
                                                                            );
                                                                            const prevTotal =
                                                                                showCompare && r.id && prevStocksMap[r.id]
                                                                                    ? Object.values(prevStocksMap[r.id]).reduce(
                                                                                          (s: number, v: any) => s + (Number(v) || 0),
                                                                                          0,
                                                                                      )
                                                                                    : null;
                                                                            return (
                                                                                <span className="inline-flex items-baseline gap-1">
                                                                                    <span>{total}</span>
                                                                                    {prevTotal !== null && (
                                                                                        <span className="text-xs font-normal text-gray-400 tabular-nums">
                                                                                            ({prevTotal})
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            {(() => {
                                                                const colTotals: Record<string, number> = {};
                                                                locs.forEach((l) => (colTotals[l] = 0));
                                                                rows.forEach((r) => {
                                                                    locs.forEach((l) => {
                                                                        colTotals[l] += Number(r.quantities[l] || 0);
                                                                    });
                                                                });
                                                                const grandTotal = Object.values(colTotals).reduce((s, v) => s + (Number(v) || 0), 0);
                                                                return (
                                                                    <tr className="border-t bg-gray-50 font-medium">
                                                                        <td className="px-2 py-2" colSpan={3}>
                                                                            合計
                                                                        </td>
                                                                        {locs.map((l) => (
                                                                            <td key={`total-${l}`} className="px-2 py-2 text-left">
                                                                                {colTotals[l] === 0 ? (
                                                                                    <span className="text-gray-400">-</span>
                                                                                ) : (
                                                                                    <span className="text-indigo-700">{colTotals[l]}</span>
                                                                                )}
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-2 py-2 text-left text-indigo-700">{grandTotal}</td>
                                                                    </tr>
                                                                );
                                                            })()}
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* シーズン管理ダイアログ */}
                <Dialog open={showSeasonDialog} onOpenChange={setShowSeasonDialog}>
                    <DialogContent className="max-h-[80vh] max-w-lg overflow-auto">
                        <DialogHeader>
                            <DialogTitle>シーズン管理</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {/* 新規シーズン追加 */}
                            <div className="rounded-md border p-3">
                                <div className="mb-2 text-sm font-medium">新規シーズンを追加</div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="例: 2025-26"
                                        value={newSeasonName}
                                        onChange={(e) => {
                                            setNewSeasonName(e.target.value);
                                            setSeasonError(null);
                                        }}
                                        className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                                        maxLength={10}
                                        pattern="\d{4}-\d{2}"
                                    />
                                    <Button size="sm" onClick={handleAddSeason} disabled={seasonSaving}>
                                        追加
                                    </Button>
                                </div>
                                <div className="mt-1 text-xs text-gray-500">YYYY-YY 形式（例: 2024-25）</div>
                                {seasonError && <div className="mt-1 text-xs text-red-600">{seasonError}</div>}
                            </div>
                            {/* シーズン一覧 */}
                            <div className="space-y-2">
                                {seasons.length === 0 && <div className="text-sm text-gray-500">シーズンがまだ登録されていません</div>}
                                {seasons.map((s: any) => (
                                    <div key={s.id} className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{s.name}</span>
                                            {s.is_active && (
                                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                                    アクティブ
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {!s.is_active && (
                                                <Button size="sm" variant="ghost" onClick={() => handleSetActive(s.id)} className="text-xs">
                                                    アクティブに設定
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeleteSeason(s.id)}
                                                className="text-xs text-red-500 hover:text-red-700"
                                            >
                                                削除
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end">
                                <Button variant="outline" onClick={() => setShowSeasonDialog(false)}>
                                    閉じる
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* CSVエラー詳細ダイアログ */}
                <Dialog open={csvErrorDialog.open} onOpenChange={(open) => setCsvErrorDialog({ ...csvErrorDialog, open })}>
                    <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-red-500" />
                                {csvErrorDialog.title}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {csvErrorDialog.errors && csvErrorDialog.errors.length > 0 && (
                                <div>
                                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
                                        <AlertCircle className="h-4 w-4" />
                                        エラー ({csvErrorDialog.errors.length}件)
                                    </h3>
                                    <div className="max-h-60 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3">
                                        <ul className="space-y-1 text-sm text-red-800">
                                            {csvErrorDialog.errors.map((error, i) => (
                                                <li key={i} className="flex gap-2">
                                                    <span className="flex-shrink-0">•</span>
                                                    <span className="whitespace-pre-line">{error}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                            {csvErrorDialog.warnings && csvErrorDialog.warnings.length > 0 && (
                                <div>
                                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-yellow-900">
                                        <AlertCircle className="h-4 w-4" />
                                        警告 ({csvErrorDialog.warnings.length}件)
                                    </h3>
                                    <div className="max-h-60 overflow-y-auto rounded-md border border-yellow-200 bg-yellow-50 p-3">
                                        <ul className="space-y-1 text-sm text-yellow-800">
                                            {csvErrorDialog.warnings.map((warning, i) => (
                                                <li key={i} className="flex gap-2">
                                                    <span className="flex-shrink-0">•</span>
                                                    <span className="whitespace-pre-line">{warning}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end">
                                <Button onClick={() => setCsvErrorDialog({ open: false, title: '', errors: [], warnings: [] })}>閉じる</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </AppSidebarLayout>
    );
}
