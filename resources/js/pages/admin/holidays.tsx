import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: '各種設定', href: route('admin.role-permissions') },
    { title: '休日登録', href: '' },
];

export default function HolidaysPage() {
    usePage(); // ensure Inertia page context is available
    const [items, setItems] = useState<Array<{ id?: number; date: string; name: string }>>([]);
    const [date, setDate] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [importYear, setImportYear] = useState(() => new Date().getFullYear());
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
    const [editingAll, setEditingAll] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, { date: string; name: string }>>({});

    useEffect(() => {
        // load full list on mount (admin needs all holidays)
        fetch();
    }, []);

    const fetch = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/holidays?all=1');
            setItems(res.data.holidays || []);
        } catch (err) {
            console.error(err);
            setToast({ message: '取得に失敗しました', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!date || !name) {
            setToast({ message: '日付と名称は必須です', type: 'error' });
            return;
        }
        try {
            await axios.post('/api/holidays', { date, name });
            setToast({ message: '登録しました', type: 'success' });
            setDate('');
            setName('');
            await fetch();
        } catch (err) {
            console.error(err);
            setToast({ message: '登録に失敗しました', type: 'error' });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('本当に削除しますか？')) return;
        try {
            await axios.delete(`/api/holidays/${id}`);
            setToast({ message: '削除しました', type: 'success' });
            await fetch();
        } catch (err) {
            console.error(err);
            setToast({ message: '削除に失敗しました', type: 'error' });
        }
    };

    const startEditAll = () => {
        // initialize drafts from items
        const d: Record<string, { date: string; name: string }> = {};
        items.forEach((it) => {
            d[String(it.id || it.date)] = { date: it.date, name: it.name };
        });
        setDrafts(d);
        setEditingAll(true);
    };

    const toggleEditAll = () => {
        if (editingAll) {
            // exit edit mode and clear drafts
            setEditingAll(false);
            setDrafts({});
        } else {
            startEditAll();
        }
    };

    const saveDraft = async (key: string) => {
        const dr = drafts[key];
        if (!dr) return;
        // find id from key
        const it = items.find((x) => String(x.id || x.date) === key);
        if (!it || !it.id) return;
        try {
            await axios.patch(`/api/holidays/${it.id}`, { date: dr.date, name: dr.name });
            setToast({ message: `${dr.date} を保存しました`, type: 'success' });
            await fetch();
        } catch (err) {
            console.error(err);
            // revert draft to original
            setDrafts((prev) => ({ ...prev, [key]: { date: it.date, name: it.name } }));
            setToast({ message: '保存に失敗しました', type: 'error' });
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="休日登録" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="休日登録" description="会社の祝日・特別休業日を管理します。" />
                </div>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>休日一覧</CardTitle>
                        <div className="flex items-center gap-2">
                            <Button onClick={toggleEditAll} variant="secondary">
                                {editingAll ? '解除' : '一括編集'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1" />
                                <input
                                    placeholder="名称"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="rounded border px-2 py-1"
                                />
                                <Button onClick={handleCreate}>追加</Button>
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm">年：</label>
                                    <select
                                        value={String(importYear)}
                                        onChange={(e) => setImportYear(parseInt(e.target.value, 10))}
                                        className="rounded border px-2 py-1"
                                    >
                                        {(() => {
                                            const cur = new Date().getFullYear();
                                            const years = [] as number[];
                                            for (let y = cur - 5; y <= cur + 5; y++) years.push(y);
                                            return years.map((y) => (
                                                <option key={y} value={y}>
                                                    {y}年
                                                </option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                                <div className="mt-2 sm:mt-0">
                                    <Button
                                        onClick={async () => {
                                            if (!confirm(`${importYear}年の祝日を外部から取得して登録します。よろしいですか？`)) return;
                                            try {
                                                setLoading(true);
                                                const res = await axios.post('/api/holidays/import-year', { year: importYear });
                                                const data = res.data;
                                                setToast({ message: `${data.created} 件登録、${data.skipped} 件スキップしました`, type: 'success' });
                                                await fetch();
                                            } catch (err) {
                                                console.error(err);
                                                setToast({ message: '自動登録に失敗しました', type: 'error' });
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                    >
                                        自動登録
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>日付</TableHead>
                                    <TableHead>名称</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((it) => {
                                    const key = String(it.id || it.date);
                                    const draft = drafts[key];
                                    return (
                                        <TableRow key={key} className="hover:bg-gray-50">
                                            <TableCell>
                                                {editingAll ? (
                                                    <input
                                                        type="date"
                                                        value={draft?.date || it.date}
                                                        onChange={(e) =>
                                                            setDrafts((prev) => ({
                                                                ...prev,
                                                                [key]: { ...(prev[key] || { date: it.date, name: it.name }), date: e.target.value },
                                                            }))
                                                        }
                                                        onBlur={() => saveDraft(key)}
                                                        className="rounded border px-2 py-1"
                                                    />
                                                ) : (
                                                    it.date
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingAll ? (
                                                    <input
                                                        value={draft?.name || it.name}
                                                        onChange={(e) =>
                                                            setDrafts((prev) => ({
                                                                ...prev,
                                                                [key]: { ...(prev[key] || { date: it.date, name: it.name }), name: e.target.value },
                                                            }))
                                                        }
                                                        onBlur={() => saveDraft(key)}
                                                        className="w-full rounded border px-2 py-1"
                                                    />
                                                ) : (
                                                    it.name
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="destructive" size="sm" onClick={() => handleDelete(it.id!)}>
                                                    削除
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppSidebarLayout>
    );
}
