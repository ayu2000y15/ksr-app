import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Trash } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';

const breadcrumbs = [
    { title: '在庫管理', href: route('inventory.index') },
    { title: '在庫カテゴリ', href: route('inventory.categories.index') },
];

const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';
    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';
    return (
        <Link href={route('inventory.categories.index', { sort: sort_key, direction: newDirection })} preserveState preserveScroll>
            <div className={`flex items-center gap-2 ${isCurrentSort ? 'text-indigo-600' : 'text-muted-foreground'}`}>
                <span>{children}</span>
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {isCurrentSort ? (
                        currentDirection === 'asc' ? (
                            <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        )
                    ) : (
                        <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                    )}
                </svg>
            </div>
        </Link>
    );
};

export default function Index({ categories: initialCategories = [], queryParams = {} }: any) {
    const [categories, setCategories] = useState(initialCategories || []);
    useEffect(() => setCategories(initialCategories || []), [initialCategories]);

    const page = usePage();
    const { permissions } = page.props as any;
    const canCreate = permissions?.category?.create || permissions?.is_system_admin;
    const canUpdate = permissions?.category?.update || permissions?.is_system_admin;
    const canDelete = permissions?.category?.delete || permissions?.is_system_admin;

    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const confirmAndDelete = (cat: any) => {
        if (!confirm(`カテゴリ「${cat.name}」を削除してもよろしいですか？`)) return;
        router.delete(route('inventory.categories.destroy', cat.id));
    };

    // Drag & drop handlers
    const onDragStart = (e: React.DragEvent, id: number) => {
        e.dataTransfer?.setData('text/plain', String(id));
        e.dataTransfer?.setData('application/my-app', 'category');
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

        // build new order array
        const ids = categories.map((c: any) => c.id);
        const fromIndex = ids.indexOf(srcId);
        const toIndex = ids.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1) return;
        // remove src
        ids.splice(fromIndex, 1);
        // insert before toIndex
        ids.splice(toIndex, 0, srcId);

        // keep previous for rollback
        const previous = categories.slice();

        // optimistically update UI and update order_column for display
        const newCategories = ids
            .map((id, idx) => {
                const found = categories.find((c: any) => c.id === id);
                return found ? { ...found, order_column: idx } : null;
            })
            .filter(Boolean) as any;
        setCategories(newCategories);
        setToast({ message: '並び替えを保存中...', type: 'info' });

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(route('inventory.categories.reorder'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                body: JSON.stringify({ order: ids }),
            });
            if (!res.ok) throw new Error('保存失敗');
            // success: keep optimistic UI (already updated). Optionally we could refresh from server.
            setToast({ message: '並び替えを保存しました', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: '並び替えの保存に失敗しました', type: 'error' });
            // rollback to previous state
            setCategories(previous);
        }
        setTimeout(() => setToast(null), 2500);
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="在庫カテゴリ" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="在庫カテゴリ" description="カテゴリの一覧・編集・削除を行う。" />
                </div>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>カテゴリ一覧</CardTitle>
                        {canCreate && (
                            <Link href={route('inventory.categories.create')}>
                                <Button>
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">新規作成</span>
                                </Button>
                            </Link>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 md:hidden">
                            {categories.map((c: any) => (
                                <div
                                    key={c.id}
                                    className={`rounded-md border p-4 hover:bg-gray-50 ${canUpdate ? 'cursor-pointer' : ''}`}
                                    onClick={() => canUpdate && router.get(route('inventory.categories.edit', c.id), {}, { preserveScroll: true })}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground">{c.name}</div>
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
                                        <TableHead>
                                            <SortableHeader sort_key="id" queryParams={queryParams}>
                                                ID
                                            </SortableHeader>
                                        </TableHead>
                                        <TableHead>
                                            <SortableHeader sort_key="name" queryParams={queryParams}>
                                                名称
                                            </SortableHeader>
                                        </TableHead>
                                        <TableHead>
                                            <SortableHeader sort_key="order_column" queryParams={queryParams}>
                                                並び順
                                            </SortableHeader>
                                        </TableHead>
                                        <TableHead className="text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map((c: any) => (
                                        <TableRow
                                            key={c.id}
                                            className="hover:bg-gray-50"
                                            onDragOver={onDragOver}
                                            onDrop={(e) => reorderOnDrop(e, c.id)}
                                        >
                                            <TableCell className="flex items-center gap-2">
                                                {/* drag handle only (dragging enabled here) */}
                                                {canUpdate ? (
                                                    <button
                                                        draggable
                                                        onDragStart={(e) => onDragStart(e, c.id)}
                                                        onDragEnd={(e) => {
                                                            // restore cursor
                                                            (e.target as HTMLElement).style.cursor = 'grab';
                                                        }}
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
                                                        router.get(route('inventory.categories.edit', c.id), {}, { preserveScroll: true })
                                                    }
                                                >
                                                    {c.id}
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className={canUpdate ? 'cursor-pointer' : ''}
                                                onClick={() =>
                                                    canUpdate && router.get(route('inventory.categories.edit', c.id), {}, { preserveScroll: true })
                                                }
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span>{c.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className={canUpdate ? 'cursor-pointer' : ''}
                                                onClick={() =>
                                                    canUpdate && router.get(route('inventory.categories.edit', c.id), {}, { preserveScroll: true })
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
