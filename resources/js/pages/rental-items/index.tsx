import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import { Edit, GripVertical, Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs = [
    { title: 'ユーザー管理', href: route('users.index') },
    { title: '貸出物マスタ', href: route('rental-items.index') },
];

export default function Index({ rentalItems: initialRentalItems }: any) {
    const [rentalItems, setRentalItems] = useState<any[]>(initialRentalItems);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // propsが更新されたらstateも更新
    useEffect(() => {
        setRentalItems(initialRentalItems);
    }, [initialRentalItems]);

    const { data, setData, post, patch, processing, errors, reset } = useForm({
        name: '',
        description: '',
        quantity: 1,
        is_active: true,
        sort_order: 0,
    });

    const openCreateDialog = () => {
        reset();
        setData({
            name: '',
            description: '',
            quantity: 1,
            is_active: true,
            sort_order: 0,
        });
        setEditingItem(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (item: any) => {
        setData({
            name: item.name || '',
            description: item.description || '',
            quantity: item.quantity || 1,
            is_active: item.is_active !== false,
            sort_order: item.sort_order || 0,
        });
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingItem) {
            // 編集
            patch(route('rental-items.update', editingItem.id), {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                    router.reload({ only: ['rentalItems'] });
                },
            });
        } else {
            // 新規作成
            post(route('rental-items.store'), {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                    router.reload({ only: ['rentalItems'] });
                },
            });
        }
    };

    const confirmAndDelete = (item: any) => {
        if (!confirm(`貸出物「${item.name}」を削除してもよろしいですか？`)) {
            return;
        }

        router.delete(route('rental-items.destroy', item.id), {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                router.reload({ only: ['rentalItems'] });
            },
        });
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="貸出物マスタ管理" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="貸出物マスタ管理" description="貸出物の登録・編集・削除" />
                </div>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>貸出物一覧</CardTitle>
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">新規登録</span>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {/* Mobile: stacked card list */}
                        <div className="space-y-3 md:hidden">
                            {rentalItems.map((item: any) => (
                                <div key={item.id} className="rounded-md border p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="truncate text-sm font-medium">{item.name}</div>
                                                {item.is_active ? (
                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">有効</Badge>
                                                ) : (
                                                    <Badge variant="outline">無効</Badge>
                                                )}
                                            </div>
                                            {item.description && (
                                                <div className="mt-1 text-xs whitespace-pre-line text-muted-foreground">{item.description}</div>
                                            )}
                                            <div className="mt-1 text-xs text-muted-foreground">数量: {item.quantity}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                                            <Edit className="mr-2 h-4 w-4" /> 編集
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(item)}>
                                            <Trash className="mr-2 h-4 w-4" /> 削除
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {rentalItems.length === 0 && (
                                <div className="py-8 text-center text-sm text-muted-foreground">貸出物が登録されていません</div>
                            )}
                        </div>

                        {/* Desktop: table view */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>
                                            <div className="sr-only">並び替え</div>
                                        </TableHead>
                                        <TableHead>表示順</TableHead>
                                        <TableHead>貸出物名</TableHead>
                                        <TableHead>説明</TableHead>
                                        <TableHead>数量</TableHead>
                                        <TableHead>ステータス</TableHead>
                                        <TableHead className="text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rentalItems.map((item: any) => (
                                        <TableRow
                                            key={item.id}
                                            draggable={true}
                                            onDragStart={(e) => {
                                                e.dataTransfer?.setData('text/plain', String(item.id));
                                                e.dataTransfer!.effectAllowed = 'move';
                                                e.currentTarget.classList.add('opacity-60');
                                            }}
                                            onDragEnd={(e) => {
                                                e.currentTarget.classList.remove('opacity-60');
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer!.dropEffect = 'move';
                                                const target = e.currentTarget as HTMLElement;
                                                target.classList.add('bg-gray-100');
                                            }}
                                            onDragLeave={(e) => {
                                                const target = e.currentTarget as HTMLElement;
                                                target.classList.remove('bg-gray-100');
                                            }}
                                            onDrop={async (e) => {
                                                e.preventDefault();
                                                const target = e.currentTarget as HTMLElement;
                                                target.classList.remove('bg-gray-100');

                                                const draggedId = Number(e.dataTransfer?.getData('text/plain'));
                                                const targetId = item.id;
                                                if (!draggedId || draggedId === targetId) return;

                                                const old = [...rentalItems];
                                                const fromIndex = old.findIndex((u) => u.id === draggedId);
                                                const toIndex = old.findIndex((u) => u.id === targetId);
                                                if (fromIndex < 0 || toIndex < 0) return;

                                                const [moved] = old.splice(fromIndex, 1);
                                                old.splice(toIndex, 0, moved);

                                                const reordered = old.map((u, i) => ({ ...u, sort_order: i + 1 }));
                                                setRentalItems(reordered);

                                                try {
                                                    await axios.post('/api/rental-items/reorder', { ids: old.map((u) => u.id) });
                                                    console.log('並び順を保存しました');
                                                } catch (err) {
                                                    console.error('reorder failed', err);
                                                    alert('並び順の保存に失敗しました。ページをリロードしてください。');
                                                    setRentalItems(initialRentalItems);
                                                }
                                            }}
                                        >
                                            <TableCell>
                                                <button
                                                    aria-label="ドラッグして並び替え"
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-600"
                                                >
                                                    <GripVertical className="h-4 w-4" />
                                                </button>
                                            </TableCell>
                                            <TableCell>{item.sort_order || '—'}</TableCell>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="whitespace-pre-line">{item.description || '—'}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>
                                                {item.is_active ? (
                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">有効</Badge>
                                                ) : (
                                                    <Badge variant="outline">無効</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" className="mr-2" onClick={() => openEditDialog(item)}>
                                                    <Edit className="mr-2 h-4 w-4" /> 編集
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(item)}>
                                                    <Trash className="mr-2 h-4 w-4" /> 削除
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {rentalItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                                貸出物が登録されていません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* 登録・編集ダイアログ */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingItem ? '貸出物を編集' : '貸出物を登録'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="name">貸出物名 *</Label>
                                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    <InputError message={errors.name} className="mt-1" />
                                </div>

                                <div>
                                    <Label htmlFor="description">説明</Label>
                                    <Textarea id="description" value={data.description} onChange={(e) => setData('description', e.target.value)} />
                                    <InputError message={errors.description} className="mt-1" />
                                </div>

                                <div>
                                    <Label htmlFor="quantity">数量 *</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        min="1"
                                        value={data.quantity}
                                        onChange={(e) => setData('quantity', parseInt(e.target.value) || 1)}
                                        required
                                    />
                                    <InputError message={errors.quantity} className="mt-1" />
                                </div>

                                <div>
                                    <Label htmlFor="sort_order">表示順</Label>
                                    <Input
                                        id="sort_order"
                                        type="number"
                                        value={data.sort_order}
                                        onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)}
                                    />
                                    <InputError message={errors.sort_order} className="mt-1" />
                                </div>

                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={data.is_active}
                                        onChange={(e) => setData('is_active', e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <Label htmlFor="is_active" className="cursor-pointer">
                                        有効
                                    </Label>
                                </div>
                            </div>

                            <DialogFooter className="mt-6">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    キャンセル
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {editingItem ? '更新' : '登録'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppSidebarLayout>
    );
}
