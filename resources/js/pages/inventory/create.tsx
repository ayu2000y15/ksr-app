// ...existing imports
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { GripVertical, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

// Remove stray closing brace
// This closing brace is causing issues with module parsing
// It should not be here
type Category = { id: number; name: string };

type ItemStock = { id?: number; storage_location?: string; quantity?: string; memo?: string };
type Item = {
    category_id: string;
    name: string;
    catalog_name: string;
    size: string;
    unit: string;
    supplier_text: string;
    memo: string;
    stocks: ItemStock[];
    id?: number;
    sort_order?: number | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: '在庫管理', href: route('inventory.index') },
    { title: '一括登録', href: route('inventory.create') },
];

export default function InventoryCreate({ categories = [], items: initialItems = [] }: { categories?: Category[]; items?: Item[] }) {
    const page = usePage();
    const pageProps = page.props as unknown as {
        permissions?: { inventory?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean; logs?: boolean } };
    };
    const inventoryPerms = pageProps.permissions?.inventory ?? { view: false, create: false, update: false, delete: false, logs: false };
    // items: bulk rows where each row corresponds to a new inventory item + optional initial stocks[]
    const [, setProcessing] = useState<boolean>(false);

    const emptyItem = (): Item => ({
        category_id: '',
        name: '',
        catalog_name: '',
        size: '',
        unit: '',
        supplier_text: '',
        memo: '',
        stocks: [{ storage_location: '', quantity: '0', memo: '' }],
    });

    // initialize from server-provided items if available
    const mapServerItem = (srv: any): Item => ({
        category_id: srv.category_id ? String(srv.category_id) : '',
        name: srv.name || '',
        catalog_name: srv.catalog_name || '',
        size: srv.size || '',
        unit: srv.unit || '',
        supplier_text: srv.supplier_text || '',
        memo: srv.memo || '',
        stocks: (srv.stocks || []).map((s: any) => ({
            storage_location: s.storage_location || '',
            quantity: s.quantity !== undefined && s.quantity !== null ? String(s.quantity) : '0',
            memo: s.memo || '',
        })) || [{ storage_location: '', quantity: '0', memo: '' }],
        id: srv.id,
        // maintain server sort if present
        sort_order: typeof srv.sort_order !== 'undefined' ? srv.sort_order : null,
    });

    const initialState: Item[] = initialItems && initialItems.length > 0 ? initialItems.map(mapServerItem) : [emptyItem()];
    const [items, setItems] = useState<Item[]>(initialState);
    const nameRefs = useRef<Array<HTMLInputElement | null>>([]);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    // filters
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterName, setFilterName] = useState<string>('');
    const [filterCatalog, setFilterCatalog] = useState<string>('');
    const [filterSupplier, setFilterSupplier] = useState<string>('');

    const onDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
        setDragIndex(index);
        // set ghost image fallback
        try {
            e.dataTransfer!.setData('text/plain', String(index));
        } catch (_) {}
    };

    const onDragEnd = () => {
        setDragIndex(null);
    };

    const onDragOverRow = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
    };

    const onDropRow = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        e.preventDefault();
        if (dragIndex === null) return;
        if (dragIndex === index) return;
            setItems((prev) => {
            const copy = [...prev];
            const [moved] = copy.splice(dragIndex, 1);
            copy.splice(index, 0, moved);
            // persist new order to server shortly after reordering
                setTimeout(() => {
                    // save order only for currently visible rows (respecting filters)
                    saveOrder(copy, { visibleOnly: true });
                }, 150);
            return copy;
        });
        setDragIndex(null);
    };

    // persist the current items order (and full data) to server so sort_order is saved
    // opts.visibleOnly: when true, only save ordering for rows currently visible under active filters
    const saveOrder = async (itemsToSave: Item[], opts?: { visibleOnly?: boolean }) => {
        if (!itemsToSave || itemsToSave.length === 0) return;
        const form = new FormData();

        // compute which indexes are visible according to current filters
        const computeVisibleIndexes = (arr: Item[]) => {
            return arr
                .map((it, i) => i)
                .filter((i) => {
                    const itv = arr[i];
                    if (!itv) return false;
                    if (filterCategory && String(itv.category_id) !== String(filterCategory)) return false;
                    if (filterName && !itv.name.toLowerCase().includes(filterName.toLowerCase())) return false;
                    if (filterCatalog && !itv.catalog_name.toLowerCase().includes(filterCatalog.toLowerCase())) return false;
                    if (filterSupplier && !itv.supplier_text.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
                    return true;
                });
        };

        if (opts?.visibleOnly) {
            const visible = computeVisibleIndexes(itemsToSave);
            // only append visible items and assign sort_order sequentially based on visible order
            visible.forEach((origIdx, pos) => {
                const it = itemsToSave[origIdx];
                if (!it) return;
                if ((it as Item).id) form.append(`items[${pos}][id]`, String((it as Item).id));
                form.append(`items[${pos}][sort_order]`, String(pos));
                form.append(`items[${pos}][name]`, it.name || '');
                form.append(`items[${pos}][category_id]`, it.category_id || '');
                form.append(`items[${pos}][catalog_name]`, it.catalog_name || '');
                form.append(`items[${pos}][size]`, it.size || '');
                form.append(`items[${pos}][unit]`, it.unit || '');
                form.append(`items[${pos}][supplier_text]`, it.supplier_text || '');
                form.append(`items[${pos}][memo]`, it.memo || '');
                if (it.stocks && Array.isArray(it.stocks)) {
                    it.stocks.forEach((s, j) => {
                        form.append(`items[${pos}][stocks][${j}][storage_location]`, s.storage_location || '');
                        form.append(`items[${pos}][stocks][${j}][quantity]`, s.quantity || '');
                        form.append(`items[${pos}][stocks][${j}][memo]`, s.memo || '');
                    });
                }
            });
        } else {
            itemsToSave.forEach((it, i) => {
                if ((it as Item).id) form.append(`items[${i}][id]`, String((it as Item).id));
                // include full fields to satisfy validation on server
                form.append(`items[${i}][sort_order]`, String(i));
                form.append(`items[${i}][name]`, it.name || '');
                form.append(`items[${i}][category_id]`, it.category_id || '');
                form.append(`items[${i}][catalog_name]`, it.catalog_name || '');
                form.append(`items[${i}][size]`, it.size || '');
                form.append(`items[${i}][unit]`, it.unit || '');
                form.append(`items[${i}][supplier_text]`, it.supplier_text || '');
                form.append(`items[${i}][memo]`, it.memo || '');
                if (it.stocks && Array.isArray(it.stocks)) {
                    it.stocks.forEach((s, j) => {
                        form.append(`items[${i}][stocks][${j}][storage_location]`, s.storage_location || '');
                        form.append(`items[${i}][stocks][${j}][quantity]`, s.quantity || '');
                        form.append(`items[${i}][stocks][${j}][memo]`, s.memo || '');
                    });
                }
            });
        }

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch('/api/inventory', {
                method: 'POST',
                credentials: 'same-origin',
                body: form,
                headers: { 'X-CSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
            });

            if (!res.ok) {
                const msg = res.status === 422 ? '並び順の保存に失敗しました（入力エラー）' : '並び順の保存に失敗しました';
                setToast({ message: msg, type: 'error' });
                return;
            }

            setToast({ message: '並び順を保存しました', type: 'success' });
            return;
        } catch (e) {
            console.error('saveOrder error', e);
            setToast({ message: '並び順の保存中にエラーが発生しました', type: 'error' });
        }
    };
    const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
    // per-row autosave status: 'idle' | 'saving' | 'saved' | 'error'
    const [rowStatuses, setRowStatuses] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});

    // compute which item indices should be displayed according to filters
    const displayIndexes = items
        .map((it, i) => i)
        .filter((i) => {
            const itv = items[i];
            if (!itv) return false;
            if (filterCategory && String(itv.category_id) !== String(filterCategory)) return false;
            if (filterName && !itv.name.toLowerCase().includes(filterName.toLowerCase())) return false;
            if (filterCatalog && !itv.catalog_name.toLowerCase().includes(filterCatalog.toLowerCase())) return false;
            if (filterSupplier && !itv.supplier_text.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
            return true;
        });

    // autosave helpers
    const saveRow = async (realIdx: number) => {
        const it = items[realIdx];
        if (!it) return;
        // mark saving
        setRowStatuses((prev) => ({ ...prev, [realIdx]: 'saving' }));
        // prepare FormData using items[0] pattern for bulk store API
        const form = new FormData();
    const i = 0;
    // ensure sort_order is sent for autosave to avoid empty sort_order on server
    form.append(`items[${i}][sort_order]`, String(realIdx));
        if ((it as Item).id) form.append(`items[${i}][id]`, String((it as Item).id));
        form.append(`items[${i}][name]`, it.name || '');
        form.append(`items[${i}][category_id]`, it.category_id || '');
        form.append(`items[${i}][catalog_name]`, it.catalog_name || '');
        form.append(`items[${i}][size]`, it.size || '');
        form.append(`items[${i}][unit]`, it.unit || '');
        form.append(`items[${i}][supplier_text]`, it.supplier_text || '');
        form.append(`items[${i}][memo]`, it.memo || '');
        if (it.stocks && Array.isArray(it.stocks)) {
            it.stocks.forEach((s, j) => {
                form.append(`items[${i}][stocks][${j}][storage_location]`, s.storage_location || '');
                form.append(`items[${i}][stocks][${j}][quantity]`, s.quantity || '');
                form.append(`items[${i}][stocks][${j}][memo]`, s.memo || '');
            });
        }

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch('/api/inventory', {
                method: 'POST',
                credentials: 'same-origin',
                body: form,
                headers: {
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            });

            if (!res.ok) {
                if (res.status === 422) {
                    // validation errors
                    const payload = await res.json();
                    const errs = payload.errors || {};
                    // Build a message with each field's messages on its own line.
                    // Server errors shape: { 'items.0.name': ['名前を入力してください。'], 'items.0.stocks.0.quantity': ['数は必須です。'] }
                    const lines: string[] = [];
                    // map field keys to Japanese labels
                    const labelForField = (field: string) => {
                        const parts = String(field).split('.');
                        const last = parts[parts.length - 1];
                        // if it's a stocks.*.xxx field, prefer stock-specific labels
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

                    Object.entries(errs).forEach(([field, arr]) => {
                        if (!Array.isArray(arr)) return;
                        const joined = arr.join(' / ');
                        const label = labelForField(field);
                        lines.push(`${label}: ${joined}`);
                    });
                    const message = lines.length > 0 ? lines.join('\n') : '入力エラーがあります。';
                    setRowStatuses((prev) => ({ ...prev, [realIdx]: 'error' }));
                    setToast({ message: `自動保存に失敗しました:\n${message}`, type: 'error' });
                    return;
                }

                const txt = await res.text();
                console.warn('autosave failed', txt);
                setRowStatuses((prev) => ({ ...prev, [realIdx]: 'error' }));
                setToast({ message: '自動保存に失敗しました。', type: 'error' });
                return;
            }

            const payload = await res.json();
            // When using items[] bulk, controller returns ['created' => [...]]
            if (payload && payload.created && Array.isArray(payload.created) && payload.created.length > 0) {
                const saved = payload.created[0];
                setItems((prev) => {
                    const copy = [...prev];
                    copy[realIdx] = { ...copy[realIdx], id: saved.id || copy[realIdx].id };
                    return copy;
                });
                setRowStatuses((prev) => ({ ...prev, [realIdx]: 'saved' }));
                setToast({ message: '自動保存しました', type: 'success' });
                setTimeout(() => setRowStatuses((prev) => ({ ...prev, [realIdx]: 'idle' })), 2000);
            } else {
                // even if no created payload, consider it saved
                setRowStatuses((prev) => ({ ...prev, [realIdx]: 'saved' }));
                setToast({ message: '自動保存しました', type: 'success' });
                setTimeout(() => setRowStatuses((prev) => ({ ...prev, [realIdx]: 'idle' })), 2000);
            }
        } catch (e) {
            console.error('autosave error', e);
            setRowStatuses((prev) => ({ ...prev, [realIdx]: 'error' }));
        }
    };

    const handleInputBlur = (realIdx: number) => {
        // schedule check after focus moves
        setTimeout(() => {
            const tr = document.querySelector(`tr[data-real-idx="${realIdx}"]`);
            const active = document.activeElement as HTMLElement | null;
            if (!tr || !active) {
                // if no row element or no active element, still attempt save
                saveRow(realIdx);
                return;
            }
            if (!tr.contains(active)) {
                // focus moved outside this row -> autosave
                saveRow(realIdx);
            }
        }, 50);
    };

    const deleteRow = async (realIdx: number) => {
        const it = items[realIdx];
        if (!it) return;
        if (it.id) {
            if (!confirm('この行を削除してよいですか？データベースからも削除されます。')) return;
            try {
                const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                const res = await fetch(`/api/inventory/${it.id}`, {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
                });
                if (!res.ok) {
                    const txt = await res.text();
                    alert('削除に失敗しました: ' + txt.slice(0, 1000));
                    setToast({ message: '削除に失敗しました', type: 'error' });
                    return;
                }
            } catch (e) {
                console.error('delete error', e);
                alert('削除中にエラーが発生しました');
                setToast({ message: '削除中にエラーが発生しました', type: 'error' });
                return;
            }
        }
        // remove from UI
        setItems((prev) => prev.filter((_, i) => i !== realIdx));
        setToast({ message: '削除しました', type: 'success' });
    };

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setServerErrors({});
        setProcessing(true);

        const form = new FormData();
        // append items[] each with fields and optional stock
        // if filters are active, preserve ordering as shown on screen (displayIndexes)
        const indexesToSend = displayIndexes && displayIndexes.length > 0 ? displayIndexes : items.map((_, i) => i);
        indexesToSend.forEach((realIdx, pos) => {
            const it = items[realIdx];
            const i = pos;
            if (!it) return;
            if ((it as Item).id) {
                form.append(`items[${i}][id]`, String((it as Item).id));
            }
            // include sort order (use visible position)
            form.append(`items[${i}][sort_order]`, String(i));
            form.append(`items[${i}][name]`, it.name || '');
            form.append(`items[${i}][category_id]`, it.category_id || '');
            form.append(`items[${i}][catalog_name]`, it.catalog_name || '');
            form.append(`items[${i}][size]`, it.size || '');
            form.append(`items[${i}][unit]`, it.unit || '');
            form.append(`items[${i}][supplier_text]`, it.supplier_text || '');
            form.append(`items[${i}][memo]`, it.memo || '');
            if (it.stocks && Array.isArray(it.stocks)) {
                it.stocks.forEach((s, j) => {
                    form.append(`items[${i}][stocks][${j}][storage_location]`, s.storage_location || '');
                    form.append(`items[${i}][stocks][${j}][quantity]`, s.quantity || '');
                    form.append(`items[${i}][stocks][${j}][memo]`, s.memo || '');
                });
            }
        });

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch('/api/inventory', {
                method: 'POST',
                credentials: 'same-origin',
                body: form,
                headers: {
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            });

            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            if (res.status === 422 && contentType.includes('application/json')) {
                const payload = await res.json();
                setServerErrors(payload.errors || {});
                return;
            }

            if (!contentType.includes('application/json')) {
                const text = await res.text();
                alert('登録に失敗しました（非JSON応答）: ' + text.slice(0, 1000));
                return;
            }

            if (!res.ok) {
                const payload = await res.json();
                alert('登録に失敗しました: ' + (payload.message || JSON.stringify(payload)));
                return;
            }

            // success — redirect to index
            setProcessing(false);
            window.location.href = route('inventory.index');
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました');
            setProcessing(false);
        }
    };
    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="在庫一括編集" />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="py-12">
                <div className="max-w-9xl mx-auto sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        {Object.keys(serverErrors || {}).length > 0 && (
                            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                <div className="font-medium">入力エラーがあります。以下を修正してください：</div>
                                <ul className="mt-2 list-disc pl-5">
                                    {Object.entries(serverErrors).map(([field, msgs]) =>
                                        (msgs || []).map((m, i) => <li key={`${field}-${i}`}>{m}</li>),
                                    )}
                                </ul>
                            </div>
                        )}

                        <Card>
                            <CardHeader className="flex items-start">
                                <div>
                                    <CardTitle>在庫一括編集</CardTitle>
                                </div>
                                <div className="ml-auto">
                                    <Link href={route('inventory.index')}>
                                        <Button variant="outline" type="button">
                                            戻る
                                        </Button>
                                    </Link>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                <div>
                                    <Label>一括登録（行を追加して複数の在庫マスタを一度に作成できます）</Label>
                                    <div className="my-2 flex items-center justify-between">
                                        <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
                                            <select
                                                className="w-full rounded border p-2 text-sm md:w-auto"
                                                value={filterCategory}
                                                onChange={(e) => setFilterCategory(e.target.value)}
                                            >
                                                <option value="">全カテゴリ</option>
                                                {categories.map((c) => (
                                                    <option key={c.id} value={String(c.id)}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <Input
                                                className="w-full md:w-56"
                                                placeholder="名称で絞り込む"
                                                value={filterName}
                                                onChange={(e) => setFilterName(e.target.value)}
                                            />
                                            <Input
                                                className="w-full md:w-56"
                                                placeholder="カタログ名で絞り込む"
                                                value={filterCatalog}
                                                onChange={(e) => setFilterCatalog(e.target.value)}
                                            />
                                            <Input
                                                className="w-full md:w-56"
                                                placeholder="仕入先で絞り込む"
                                                value={filterSupplier}
                                                onChange={(e) => setFilterSupplier(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-3 text-sm text-gray-600">
                                        ※行内のいずれかの入力欄からフォーカスが外れると、その行は自動保存されます<br></br>
                                        ※保存・エラーは画面右下の通知でお知らせします
                                    </div>
                                    <div className="my-2 flex items-center justify-between">
                                        <div className="hidden text-sm text-gray-500 md:block">ドラッグで行を並べ替えできます</div>

                                        {inventoryPerms.create || inventoryPerms.update ? (
                                            <button
                                                type="button"
                                                className="rounded bg-indigo-600 px-3 py-1 text-white"
                                                onClick={() => {
                                                    setItems((prev) => {
                                                        const copy = [emptyItem(), ...prev];
                                                        // focus will be applied after DOM updates
                                                        setTimeout(() => {
                                                            nameRefs.current[0]?.focus();
                                                        }, 50);
                                                        return copy;
                                                    });
                                                }}
                                            >
                                                行を追加
                                            </button>
                                        ) : null}
                                    </div>

                                    <div className="mt-2 overflow-x-auto">
                                        {/* Mobile: stacked cards for easy entry (shown on small screens) */}
                                        <div className="space-y-3 md:hidden">
                                            {displayIndexes.map((realIdx) => {
                                                const row = items[realIdx];
                                                return (
                                                    <div key={`mobile-${realIdx}`} className="rounded border bg-white p-3">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <div className="text-sm font-medium">{row.id ? row.id : '#'}</div>
                                                                <div className="text-xs text-gray-500">並び順: {realIdx}</div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                {inventoryPerms.delete && (
                                                                    <button
                                                                        type="button"
                                                                        className="text-sm text-red-500"
                                                                        onClick={() => deleteRow(realIdx)}
                                                                    >
                                                                        削除
                                                                    </button>
                                                                )}
                                                                {(inventoryPerms.create || inventoryPerms.update) && (
                                                                    <button
                                                                        type="button"
                                                                        className="text-sm text-gray-700"
                                                                        onClick={() =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                const clone = JSON.parse(JSON.stringify(copy[realIdx]));
                                                                                if ((clone as any).id) delete (clone as any).id;
                                                                                if (clone.stocks && Array.isArray(clone.stocks)) {
                                                                                    clone.stocks = clone.stocks.map((s: any) => {
                                                                                        const ns = { ...s };
                                                                                        if (ns.id) delete ns.id;
                                                                                        return ns;
                                                                                    });
                                                                                }
                                                                                copy.splice(realIdx + 1, 0, clone);
                                                                                setTimeout(() => {
                                                                                    const focusIdx = realIdx + 1;
                                                                                    nameRefs.current[focusIdx]?.focus();
                                                                                }, 50);
                                                                                return copy;
                                                                            })
                                                                        }
                                                                    >
                                                                        コピー
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 space-y-3">
                                                            <div>
                                                                <Label>カテゴリ</Label>
                                                                <select
                                                                    className="w-full rounded border p-2 text-sm"
                                                                    value={row.category_id}
                                                                    onChange={(e) =>
                                                                        setItems((prev) => {
                                                                            const copy = [...prev];
                                                                            copy[realIdx] = { ...copy[realIdx], category_id: e.target.value };
                                                                            return copy;
                                                                        })
                                                                    }
                                                                    onBlur={() => handleInputBlur(realIdx)}
                                                                    required
                                                                >
                                                                    <option value="">選択</option>
                                                                    {categories.map((c) => (
                                                                        <option key={c.id} value={String(c.id)}>
                                                                            {c.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div>
                                                                <Label>名称</Label>
                                                                <Input
                                                                    ref={(el: any) => (nameRefs.current[realIdx] = el)}
                                                                    value={row.name}
                                                                    onChange={(e) =>
                                                                        setItems((prev) => {
                                                                            const copy = [...prev];
                                                                            copy[realIdx] = { ...copy[realIdx], name: e.target.value };
                                                                            return copy;
                                                                        })
                                                                    }
                                                                    onBlur={() => handleInputBlur(realIdx)}
                                                                    required
                                                                />
                                                            </div>

                                                            <div>
                                                                <Label>在庫 (場所 / 数)</Label>
                                                                <div className="space-y-2">
                                                                    {row.stocks.map((s, si) => (
                                                                        <div key={si} className="flex gap-2">
                                                                            <Input
                                                                                placeholder="場所"
                                                                                value={s.storage_location || ''}
                                                                                onChange={(e) =>
                                                                                    setItems((prev) => {
                                                                                        const copy = [...prev];
                                                                                        const stocks = copy[realIdx].stocks.slice();
                                                                                        stocks[si] = {
                                                                                            ...stocks[si],
                                                                                            storage_location: e.target.value,
                                                                                        };
                                                                                        copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                        return copy;
                                                                                    })
                                                                                }
                                                                                required
                                                                                onBlur={() => handleInputBlur(realIdx)}
                                                                            />
                                                                            <Input
                                                                                type="number"
                                                                                placeholder="数"
                                                                                value={s.quantity || ''}
                                                                                onChange={(e) =>
                                                                                    setItems((prev) => {
                                                                                        const copy = [...prev];
                                                                                        const stocks = copy[realIdx].stocks.slice();
                                                                                        stocks[si] = { ...stocks[si], quantity: e.target.value };
                                                                                        copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                        return copy;
                                                                                    })
                                                                                }
                                                                                required
                                                                                onBlur={() => handleInputBlur(realIdx)}
                                                                            />
                                                                        </div>
                                                                    ))}

                                                                    <div>
                                                                        <button
                                                                            type="button"
                                                                            className="text-sm text-blue-600"
                                                                            onClick={() =>
                                                                                setItems((prev) => {
                                                                                    const copy = [...prev];
                                                                                    const stocks = copy[realIdx].stocks.slice();
                                                                                    stocks.push({ storage_location: '', quantity: '0', memo: '' });
                                                                                    copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                    setTimeout(() => {
                                                                                        const nameEl = nameRefs.current[realIdx];
                                                                                        const tr = nameEl?.closest('tr') as
                                                                                            | HTMLTableRowElement
                                                                                            | undefined;
                                                                                        const input = tr?.querySelectorAll('input')[0] as
                                                                                            | HTMLInputElement
                                                                                            | undefined;
                                                                                        input?.focus();
                                                                                    }, 50);
                                                                                    return copy;
                                                                                })
                                                                            }
                                                                        >
                                                                            在庫行を追加
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Desktop/table view (md+) - keep existing table for PC */}
                                        <div className="hidden md:block">
                                            <table className="w-full table-auto border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50 text-left text-sm">
                                                        <th className="border px-2 py-2">#</th>
                                                        <th className="border px-2 py-2">
                                                            カテゴリ <span className="text-red-500">*</span>
                                                        </th>
                                                        <th className="border px-2 py-2">
                                                            名称 <span className="text-red-500">*</span>
                                                        </th>
                                                        <th className="border px-2 py-2">カタログ名</th>
                                                        <th className="border px-2 py-2">サイズ</th>
                                                        <th className="border px-2 py-2">単位</th>
                                                        <th className="border px-2 py-2">仕入れ先</th>
                                                        <th className="border px-2 py-2">メモ</th>
                                                        <th className="border px-2 py-2">
                                                            在庫 <span className="text-red-500">*</span>
                                                            <div className="text-xs text-gray-500">(場所 / 数)</div>
                                                        </th>
                                                        <th className="border px-2 py-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayIndexes.map((realIdx, displayIdx) => {
                                                        const row = items[realIdx];
                                                        return (
                                                            <tr
                                                                key={realIdx}
                                                                data-real-idx={realIdx}
                                                                className="align-top odd:bg-white even:bg-gray-50"
                                                                onDragOver={onDragOverRow}
                                                                onDrop={(e) => onDropRow(e, realIdx)}
                                                            >
                                                                <td className="w-12 border px-2 py-2 align-top">
                                                                    <div className="flex items-center gap-2">
                                                                        <div
                                                                            className="cursor-grab text-gray-500"
                                                                            draggable
                                                                            onDragStart={(e) => onDragStart(e, realIdx)}
                                                                            onDragEnd={onDragEnd}
                                                                        >
                                                                            <GripVertical size={16} />
                                                                        </div>
                                                                        <div className="text-sm font-medium">{row.id ? row.id : '#'}</div>
                                                                    </div>
                                                                    <div className="ml-1">
                                                                        {rowStatuses[realIdx] === 'saving' && (
                                                                            <div className="text-xs text-gray-500">保存中…</div>
                                                                        )}
                                                                        {rowStatuses[realIdx] === 'saved' && (
                                                                            <div className="text-xs text-green-600">保存済み</div>
                                                                        )}
                                                                        {rowStatuses[realIdx] === 'error' && (
                                                                            <div className="text-xs text-red-600">エラー</div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="w-40 border px-2 py-2 align-top">
                                                                    <select
                                                                        className="w-full rounded border p-1 text-sm"
                                                                        value={row.category_id}
                                                                        onChange={(e) =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                copy[realIdx] = { ...copy[realIdx], category_id: e.target.value };
                                                                                return copy;
                                                                            })
                                                                        }
                                                                        onBlur={() => handleInputBlur(realIdx)}
                                                                        required
                                                                    >
                                                                        <option value="">選択</option>
                                                                        {categories.map((c) => (
                                                                            <option key={c.id} value={c.id}>
                                                                                {c.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="w-48 border px-2 py-2 align-top">
                                                                    <Input
                                                                        ref={(el: any) => (nameRefs.current[realIdx] = el)}
                                                                        value={row.name}
                                                                        onChange={(e) =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                copy[realIdx] = { ...copy[realIdx], name: e.target.value };
                                                                                return copy;
                                                                            })
                                                                        }
                                                                        onBlur={() => handleInputBlur(realIdx)}
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="w-40 border px-2 py-2 align-top">
                                                                    <Input
                                                                        value={row.catalog_name}
                                                                        onChange={(e) =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                copy[realIdx] = { ...copy[realIdx], catalog_name: e.target.value };
                                                                                return copy;
                                                                            })
                                                                        }
                                                                        onBlur={() => handleInputBlur(realIdx)}
                                                                    />
                                                                </td>
                                                                <td className="w-24 border px-2 py-2 align-top">
                                                                    <Input
                                                                        value={row.size}
                                                                        onChange={(e) =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                copy[realIdx] = { ...copy[realIdx], size: e.target.value };
                                                                                return copy;
                                                                            })
                                                                        }
                                                                        onBlur={() => handleInputBlur(realIdx)}
                                                                    />
                                                                </td>
                                                                <td className="w-20 border px-2 py-2 align-top">
                                                                    <Input
                                                                        value={row.unit}
                                                                        onChange={(e) =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                copy[realIdx] = { ...copy[realIdx], unit: e.target.value };
                                                                                return copy;
                                                                            })
                                                                        }
                                                                        onBlur={() => handleInputBlur(realIdx)}
                                                                    />
                                                                </td>
                                                                <td className="w-40 border px-2 py-2 align-top">
                                                                    <Input
                                                                        value={row.supplier_text}
                                                                        onChange={(e) =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                copy[realIdx] = { ...copy[realIdx], supplier_text: e.target.value };
                                                                                return copy;
                                                                            })
                                                                        }
                                                                        onBlur={() => handleInputBlur(realIdx)}
                                                                    />
                                                                </td>
                                                                <td className="w-48 border px-2 py-2 align-top">
                                                                    <Input
                                                                        value={row.memo}
                                                                        onChange={(e) =>
                                                                            setItems((prev) => {
                                                                                const copy = [...prev];
                                                                                copy[realIdx] = { ...copy[realIdx], memo: e.target.value };
                                                                                return copy;
                                                                            })
                                                                        }
                                                                        onBlur={() => handleInputBlur(realIdx)}
                                                                    />
                                                                </td>
                                                                <td className="w-56 border px-2 py-2 align-top">
                                                                    <div className="space-y-2">
                                                                        {row.stocks.map((s, si) => (
                                                                            <div key={si} className="flex gap-2">
                                                                                <Input
                                                                                    placeholder="場所"
                                                                                    value={s.storage_location || ''}
                                                                                    onChange={(e) =>
                                                                                        setItems((prev) => {
                                                                                            const copy = [...prev];
                                                                                            const stocks = copy[realIdx].stocks.slice();
                                                                                            stocks[si] = {
                                                                                                ...stocks[si],
                                                                                                storage_location: e.target.value,
                                                                                            };
                                                                                            copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                            return copy;
                                                                                        })
                                                                                    }
                                                                                    required
                                                                                    onBlur={() => handleInputBlur(realIdx)}
                                                                                />
                                                                                <Input
                                                                                    type="number"
                                                                                    placeholder="数"
                                                                                    value={s.quantity || ''}
                                                                                    onChange={(e) =>
                                                                                        setItems((prev) => {
                                                                                            const copy = [...prev];
                                                                                            const stocks = copy[realIdx].stocks.slice();
                                                                                            stocks[si] = { ...stocks[si], quantity: e.target.value };
                                                                                            copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                            return copy;
                                                                                        })
                                                                                    }
                                                                                    required
                                                                                    onBlur={() => handleInputBlur(realIdx)}
                                                                                />
                                                                                <Input
                                                                                    placeholder="メモ"
                                                                                    value={s.memo || ''}
                                                                                    onChange={(e) =>
                                                                                        setItems((prev) => {
                                                                                            const copy = [...prev];
                                                                                            const stocks = copy[realIdx].stocks.slice();
                                                                                            stocks[si] = { ...stocks[si], memo: e.target.value };
                                                                                            copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                            return copy;
                                                                                        })
                                                                                    }
                                                                                    onBlur={() => handleInputBlur(realIdx)}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    className="text-sm text-red-500"
                                                                                    onClick={() => {
                                                                                        setItems((prev) => {
                                                                                            const copy = [...prev];
                                                                                            const stocks = copy[realIdx].stocks.slice();
                                                                                            stocks.splice(si, 1);
                                                                                            copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                            return copy;
                                                                                        });
                                                                                        setTimeout(() => {
                                                                                            saveRow(realIdx);
                                                                                        }, 50);
                                                                                    }}
                                                                                >
                                                                                    <X className="h-4 w-4" />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                        <div>
                                                                            <button
                                                                                type="button"
                                                                                className="text-sm text-blue-600"
                                                                                onClick={() =>
                                                                                    setItems((prev) => {
                                                                                        const copy = [...prev];
                                                                                        const stocks = copy[realIdx].stocks.slice();
                                                                                        stocks.push({
                                                                                            storage_location: '',
                                                                                            quantity: '0',
                                                                                            memo: '',
                                                                                        });
                                                                                        copy[realIdx] = { ...copy[realIdx], stocks };
                                                                                        setTimeout(() => {
                                                                                            const nameEl = nameRefs.current[realIdx];
                                                                                            const tr = nameEl?.closest('tr') as
                                                                                                | HTMLTableRowElement
                                                                                                | undefined;
                                                                                            const input = tr?.querySelectorAll('input')[0] as
                                                                                                | HTMLInputElement
                                                                                                | undefined;
                                                                                            input?.focus();
                                                                                        }, 50);
                                                                                        return copy;
                                                                                    })
                                                                                }
                                                                                onBlur={() => handleInputBlur(realIdx)}
                                                                            >
                                                                                在庫行を追加
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="w-28 border px-2 py-2 align-top">
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            className="text-sm text-red-500"
                                                                            onClick={() => deleteRow(realIdx)}
                                                                        >
                                                                            削除
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="text-sm text-gray-700"
                                                                            onClick={() =>
                                                                                setItems((prev) => {
                                                                                    const copy = [...prev];
                                                                                    const clone = JSON.parse(JSON.stringify(copy[realIdx]));
                                                                                    if ((clone as any).id) delete (clone as any).id;
                                                                                    if (clone.stocks && Array.isArray(clone.stocks)) {
                                                                                        clone.stocks = clone.stocks.map((s: any) => {
                                                                                            const ns = { ...s };
                                                                                            if (ns.id) delete ns.id;
                                                                                            return ns;
                                                                                        });
                                                                                    }
                                                                                    copy.splice(realIdx + 1, 0, clone);
                                                                                    setTimeout(() => {
                                                                                        const focusIdx = realIdx + 1;
                                                                                        nameRefs.current[focusIdx]?.focus();
                                                                                    }, 50);
                                                                                    return copy;
                                                                                })
                                                                            }
                                                                        >
                                                                            コピー
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="mt-3">{/* bottom add button removed - button moved to table top for easier access */}</div>
                                </div>
                            </CardContent>

                            {/* 登録処理は自動保存または別UIで管理するため、下部の登録ボタンは削除しました */}
                        </Card>
                    </form>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
