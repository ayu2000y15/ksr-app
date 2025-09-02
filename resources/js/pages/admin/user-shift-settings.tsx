import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function UserShiftSettings(): JSX.Element {
    const page: any = usePage();
    const users = page.props.users || [];
    const settings = page.props.settings || {};

    // 最大ID桁数を計算して、ID表示部分の幅を固定する（名前の頭を揃えるため）
    const maxIdDigits = Math.max(2, ...(users || []).map((u: any) => String(u.id).length));

    const breadcrumbs = [
        { title: '各種設定', href: route('admin.role-permissions') },
        { title: 'ユーザー別休暇上限設定', href: '' },
    ];

    const [rows, setRows] = useState(() =>
        users.map((u: any) => ({
            user_id: u.id,
            user_name: u.name,
            monthly_leave_limit: settings[u.id]?.monthly_leave_limit ?? settings[u.id]?.vacation_limit ?? 0,
            setting_id: settings[u.id]?.id ?? null,
        })),
    );

    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const saveRow = async (row: any) => {
        const payload = { user_id: row.user_id, monthly_leave_limit: Number(row.monthly_leave_limit || 0) };
        try {
            if (row.setting_id) {
                await router.patch(route('admin.user-shift-settings.update', row.setting_id), payload);
                setToast({ message: '更新しました', type: 'success' });
                return;
            }

            const csrfToken = (page.props as any).csrf || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

            const res = await fetch(route('admin.user-shift-settings.store'), {
                method: 'POST',
                credentials: 'same-origin', // send cookies so Laravel session/csrf is validated
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify(payload),
            });

            if (res.status === 419) {
                // CSRF/session expired
                setToast({ message: 'セッションの有効期限が切れました。ページをリロードして再試行してください。', type: 'error' });
                return;
            }

            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, setting_id: data.id } : r)));
            setToast({ message: '作成しました', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: '保存に失敗しました', type: 'error' });
        }
    };

    const deleteRow = async (row: any) => {
        if (!row.setting_id) return;
        if (!confirm('削除してよいですか？')) return;
        try {
            await router.delete(route('admin.user-shift-settings.destroy', row.setting_id));
            setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, setting_id: null, monthly_leave_limit: 0 } : r)));
            setToast({ message: '削除しました', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: '削除に失敗しました', type: 'error' });
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー別休暇上限設定" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <h2 className="text-lg font-medium">ユーザー別休暇上限設定</h2>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>一覧（行内で上限を変更して保存してください）</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ユーザー</TableHead>
                                    <TableHead>休暇上限(日)</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r: any, idx: number) => (
                                    <TableRow key={r.user_id}>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <span
                                                    className="inline-block text-right font-mono text-sm text-muted-foreground"
                                                    style={{ width: `${maxIdDigits}ch` }}
                                                >
                                                    {String(r.user_id)}
                                                </span>
                                                <span className="ml-3 truncate">{r.user_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <input
                                                type="number"
                                                value={r.monthly_leave_limit}
                                                min={0}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value);
                                                    setRows((prev) => {
                                                        const copy = [...prev];
                                                        copy[idx] = { ...copy[idx], monthly_leave_limit: v };
                                                        return copy;
                                                    });
                                                }}
                                                className="w-24 rounded border px-2 py-1"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button className="mr-2" onClick={() => saveRow(r)}>
                                                保存
                                            </Button>
                                            {/* <Button variant="destructive" onClick={() => deleteRow(r)}>
                                                <Trash className="h-4 w-4" />
                                            </Button> */}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppSidebarLayout>
    );
}
