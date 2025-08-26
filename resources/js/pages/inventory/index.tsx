import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';

export default function Index({ items: initial }: any) {
    const page = usePage();
    const inventoryPerms = ((page.props as any)?.permissions || {}).inventory || {
        view: false,
        create: false,
        update: false,
        delete: false,
        logs: false,
    };
    const [items, setItems] = useState(initial?.data || []);
    useEffect(() => setItems(initial?.data || []), [initial]);

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
            // use indices that map to server-side expectation; we will include item id to update
            rows.forEach((r, i) => {
                if (!r.id) return; // skip unsaved items
                form.append(`items[${i}][id]`, String(r.id));
                // include required fields from existing item so validation passes
                const orig = items.find((it: any) => it.id === r.id);
                if (orig) {
                    form.append(`items[${i}][name]`, orig.name || '');
                    form.append(`items[${i}][category_id]`, String(orig.category_id || orig.category?.id || ''));
                    // optionally include other fields to be safe
                    form.append(`items[${i}][catalog_name]`, orig.catalog_name || '');
                    form.append(`items[${i}][size]`, orig.size || '');
                    form.append(`items[${i}][unit]`, orig.unit || '');
                    form.append(`items[${i}][supplier_text]`, orig.supplier_text || '');
                    form.append(`items[${i}][memo]`, orig.memo || '');
                }
                // append stocks per location
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
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <HeadingSmall title="在庫管理" description="カテゴリごとに在庫を表示。" />
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                        {/* カテゴリ編集: show if user can update inventory categories (use inventory.update as proxy) */}
                        {inventoryPerms.update && (
                            <Link href={route('inventory.categories.index')}>
                                <Button size="sm" variant="ghost" className="whitespace-nowrap">
                                    カテゴリ編集
                                </Button>
                            </Link>
                        )}
                        {/* 在庫ログ: show if user can view logs */}
                        {inventoryPerms.logs && (
                            <Link href={route('inventory.stock_logs.index')}>
                                <Button size="sm" variant="ghost" className="whitespace-nowrap">
                                    在庫ログ
                                </Button>
                            </Link>
                        )}
                        {/* 一括編集: show if user can create/update inventory */}
                        {(inventoryPerms.create || inventoryPerms.update) && (
                            <Link href={route('inventory.create')}>
                                <Button className="whitespace-nowrap">
                                    <Plus className="mr-2 h-4 w-4" /> 一括編集
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {categories.map((cat) => (
                        <Card key={`cat-${cat.id}-${cat.name}`}>
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>
                                    {cat.name}
                                    <div className="text-sm text-gray-500">{cat.items.length} 件</div>
                                </CardTitle>
                                <div className="flex items-center gap-2"></div>
                                {editingCategory === (cat.id ? String(cat.id) : 'uncategorized') ? (
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

                                    // build rows keyed by item id
                                    const itemMap: Record<string, any> = {};
                                    cat.items.forEach((it: any) => {
                                        // prefix numeric ids so Object.keys preserves insertion order
                                        const key = it.id ? `id-${it.id}` : `${it.name}-${it.catalog_name}-${it.size}`;
                                        if (!itemMap[key]) {
                                            itemMap[key] = {
                                                id: it.id,
                                                name: it.name,
                                                catalog_name: it.catalog_name,
                                                size_with_unit: `${it.size || ''}${it.unit ? String(it.unit) : ''}`,
                                                quantities: {},
                                            };
                                            // initialize quantities for each loc
                                            locs.forEach((l) => (itemMap[key].quantities[l] = 0));
                                        }
                                        const stocks =
                                            it.stocks && Array.isArray(it.stocks) && it.stocks.length > 0
                                                ? it.stocks
                                                : [{ storage_location: '未指定', quantity: 0 }];
                                        stocks.forEach((st: any) => {
                                            const loc = (st.storage_location || '未指定').toString().trim() || '未指定';
                                            const qty = Number(st.quantity) || 0;
                                            if (typeof itemMap[key].quantities[loc] === 'undefined') itemMap[key].quantities[loc] = qty;
                                            else itemMap[key].quantities[loc] += qty;
                                        });
                                    });

                                    const rows: any[] = Object.keys(itemMap).map((k) => itemMap[k]);

                                    return (
                                        <div>
                                            {/* mobile: stacked cards (no horizontal scroll) */}
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
                                                                {Object.values(r.quantities).reduce((s: number, v: any) => s + (Number(v) || 0), 0)}
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
                                                                                className={qty === 0 ? 'text-gray-400' : 'font-medium text-sky-600'}
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
                                                                            ) : qty === 0 ? (
                                                                                <span className="text-gray-400">-</span>
                                                                            ) : (
                                                                                <span className="font-medium text-sky-600">{qty}</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="px-2 py-2 text-left font-medium text-indigo-700">
                                                                    {Object.values(r.quantities).reduce(
                                                                        (s: number, v: any) => s + (Number(v) || 0),
                                                                        0,
                                                                    )}
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
                            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                        </Card>
                    ))}
                </div>
            </div>
        </AppSidebarLayout>
    );
}
