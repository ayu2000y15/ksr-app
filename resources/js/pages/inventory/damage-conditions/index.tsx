import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs = [
    { title: '在庫管理', href: route('inventory.index') },
    { title: '破損在庫管理', href: route('inventory.damaged') },
    { title: '破損状態', href: route('inventory.damage-conditions.index') },
];

// Note: sortable column header component removed — not used in this list and triggered lint warnings.

type DamageCondition = { id: number; condition: string; order_column?: number };

export default function Index({ items: initialItems = [] }: { items?: DamageCondition[] }) {
    const [items, setItems] = useState<DamageCondition[]>(initialItems || []);
    useEffect(() => setItems(initialItems || []), [initialItems]);

    const page = usePage();
    const { permissions } = page.props as unknown as { permissions?: unknown };
    // Use damaged_inventory.* group from shared permissions
    type Perms = { damaged_inventory?: { view?: boolean; create?: boolean; update?: boolean; delete?: boolean }; is_system_admin?: boolean };
    const permsObj = typeof permissions === 'object' && permissions !== null ? (permissions as unknown as Perms) : ({} as Perms);
    const canCreate = Boolean(permsObj.damaged_inventory?.create || permsObj.is_system_admin);
    const canUpdate = Boolean(permsObj.damaged_inventory?.update || permsObj.is_system_admin);
    const canDelete = Boolean(permsObj.damaged_inventory?.delete || permsObj.is_system_admin);

    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    // show server flash messages if present
    useEffect(() => {
        const flash = (page.props as any).flash || {};
        if (flash?.success) setToast({ message: flash.success, type: 'success' });
        if (flash?.error) setToast({ message: flash.error, type: 'error' });
        if (flash?.info) setToast({ message: flash.info, type: 'info' });
        if (flash?.success || flash?.error || flash?.info) setTimeout(() => setToast(null), 3000);
    }, [page.props]);

    const confirmAndDelete = async (it: DamageCondition) => {
        if (!confirm(`破損状態「${it.condition}」を削除してもよろしいですか？`)) return;
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(route('inventory.damage-conditions.destroy', it.id), {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            });

            const isJson = res.headers.get('content-type')?.includes('application/json');
            if (isJson) {
                const body = await res.json();
                if (!res.ok) {
                    const msg = (body && (body.error || body.message)) || '破損状態の削除に失敗しました';
                    setToast({ message: msg, type: 'error' });
                    setTimeout(() => setToast(null), 3500);
                    return;
                }
                if (body && body.error) {
                    setToast({ message: body.error, type: 'error' });
                    setTimeout(() => setToast(null), 3500);
                    return;
                }
                if (body && body.success) {
                    setToast({ message: body.success, type: 'success' });
                    setTimeout(() => setToast(null), 2500);
                }
            }

            router.get(route('inventory.damage-conditions.index'), {}, { preserveState: false, preserveScroll: false });
        } catch (err) {
            console.error(err);
            setToast({ message: '破損状態の削除に失敗しました', type: 'error' });
            setTimeout(() => setToast(null), 3500);
        }
    };

    // Drag & drop handlers (same pattern as categories)
    const onDragStart = (e: React.DragEvent, id: number) => {
        e.dataTransfer?.setData('text/plain', String(id));
        e.dataTransfer?.setData('application/my-app', 'damage_condition');
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
    };

    const reorderOnDrop = async (e: React.DragEvent, targetId: number) => {
        e.preventDefault();
        const src = e.dataTransfer?.getData('text/plain');
        if (!src) return;
        const srcId = Number(src);
        if (Number.isNaN(srcId)) return;

        const ids = items.map((c) => c.id);
        const fromIndex = ids.indexOf(srcId);
        const toIndex = ids.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1) return;
        ids.splice(fromIndex, 1);
        ids.splice(toIndex, 0, srcId);

        const previous = items.slice();
        const newItems = ids
            .map((id, idx) => {
                const found = items.find((c) => c.id === id);
                return found ? { ...found, order_column: idx } : null;
            })
            .filter(Boolean) as DamageCondition[];
        setItems(newItems);
        setToast({ message: '並び替えを保存中...', type: 'info' });

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(route('inventory.damage-conditions.reorder'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                body: JSON.stringify({ order: ids }),
            });
            if (!res.ok) throw new Error('保存失敗');
            setToast({ message: '並び替えを保存しました', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: '並び替えの保存に失敗しました', type: 'error' });
            setItems(previous);
        }
        setTimeout(() => setToast(null), 2500);
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="破損状態" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="破損状態" description="破損状態の一覧・編集・削除を行う。" />
                </div>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>破損状態一覧</CardTitle>
                        {canCreate && (
                            <Link href={route('inventory.damage-conditions.create')}>
                                <Button>
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">新規作成</span>
                                </Button>
                            </Link>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 md:hidden">
                            {items.map((c: DamageCondition) => (
                                <div
                                    key={c.id}
                                    className={`rounded-md border p-4 hover:bg-gray-50 ${canUpdate ? 'cursor-pointer' : ''}`}
                                    onClick={() =>
                                        canUpdate && router.get(route('inventory.damage-conditions.edit', c.id), {}, { preserveScroll: true })
                                    }
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground">{c.condition}</div>
                                            <div className="mt-1 truncate text-xs text-muted-foreground">並び順: {c.order_column ?? '-'}</div>
                                        </div>
                                        <div className="flex flex-col items-end space-y-2">
                                            <div className="text-xs text-muted-foreground">ID: {c.id}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="hidden md:block">
                            <div className="text-sm text-gray-500">ドラッグで行を並べ替えできます</div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>状態</TableHead>
                                        <TableHead>並び順</TableHead>
                                        <TableHead className="text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((c: DamageCondition) => (
                                        <TableRow
                                            key={c.id}
                                            className="hover:bg-gray-50"
                                            onDragOver={onDragOver}
                                            onDrop={(e) => reorderOnDrop(e, c.id)}
                                        >
                                            <TableCell className="flex items-center gap-2">
                                                {canUpdate ? (
                                                    <button
                                                        draggable
                                                        onDragStart={(e) => onDragStart(e, c.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        title="並び替え"
                                                        className="cursor-grab rounded p-1 hover:bg-gray-100"
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            className="h-4 w-4 text-gray-500"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth="2"
                                                                d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"
                                                            />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <span className="w-4" />
                                                )}

                                                <div
                                                    className={canUpdate ? 'cursor-pointer' : ''}
                                                    onClick={() =>
                                                        canUpdate &&
                                                        router.get(route('inventory.damage-conditions.edit', c.id), {}, { preserveScroll: true })
                                                    }
                                                >
                                                    {c.id}
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className={canUpdate ? 'cursor-pointer' : ''}
                                                onClick={() =>
                                                    canUpdate &&
                                                    router.get(route('inventory.damage-conditions.edit', c.id), {}, { preserveScroll: true })
                                                }
                                            >
                                                {c.condition}
                                            </TableCell>
                                            <TableCell
                                                className={canUpdate ? 'cursor-pointer' : ''}
                                                onClick={() =>
                                                    canUpdate &&
                                                    router.get(route('inventory.damage-conditions.edit', c.id), {}, { preserveScroll: true })
                                                }
                                            >
                                                {c.order_column ?? '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canDelete && (
                                                    <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(c)}>
                                                        <Trash className="mr-2 h-4 w-4" /> 削除
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
