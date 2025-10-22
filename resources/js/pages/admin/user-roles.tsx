import Toast from '@/components/ui/toast';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';

import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem, Role, User } from '@/types';

// パンくずリストの定義
const breadcrumbs: BreadcrumbItem[] = [
    { title: '各種設定', href: '#' },
    { title: 'ユーザーへのロール割り当て', href: route('admin.user-roles') },
];

export default function UserRolesPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [checked, setChecked] = useState<Record<number, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);

    const page = usePage();
    const { permissions } = page.props as any;

    // 権限チェック関数
    const canUpdateUsers = permissions?.user?.update || permissions?.is_system_admin;

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    // compute max digits for user position/id so we can align names
    const maxIdDigits = Math.max(2, ...(users || []).map((u) => String(u.position ?? u.id).length));

    const fetchUsers = async () => {
        const res = await axios.get('/api/users');
        // Server now returns users ordered by position then id. Respect server-side order.
        const data = Array.isArray(res.data) ? (res.data as User[]) : (res.data.users ?? res.data);
        setUsers(data as User[]);
    };
    const fetchRoles = async () => {
        const res = await axios.get('/api/roles');
        setRoles(res.data);
    };

    const handleUserSelect = (userId: number) => {
        const user = users.find((u) => u.id === userId) || null;
        setSelectedUser(user);
        const map: Record<number, boolean> = {};
        (user?.roles || []).forEach((r) => {
            map[r.id] = true;
        });
        setChecked(map);
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        setIsSaving(true);
        const role_ids = Object.keys(checked)
            .filter((id) => checked[Number(id)])
            .map(Number);

        await axios.post(`/api/users/${selectedUser.id}/roles`, { role_ids });

        await fetchUsers(); // ユーザーリストを再取得してリレーションを更新
        setIsSaving(false);
        setToast({ message: '保存しました', type: 'success' });
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザーへのロール割り当て" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <Heading title="ユーザーへのロール割り当て" description="各ユーザーにどの役割を持たせるかを設定する。" />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>ユーザーとロールの関連付け</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="rounded-md border">
                                <div className="border-b p-2 font-semibold">ユーザー</div>
                                <ul className="max-h-96 overflow-y-auto">
                                    {users.map((u) => (
                                        <li
                                            key={u.id}
                                            className={`cursor-pointer p-2 text-sm hover:bg-muted/50 ${selectedUser?.id === u.id ? 'bg-muted' : ''}`}
                                            onClick={() => handleUserSelect(u.id)}
                                        >
                                            <div className="flex items-center">
                                                <span
                                                    className="inline-block text-right font-mono text-sm text-muted-foreground"
                                                    style={{ width: `${maxIdDigits}ch` }}
                                                >
                                                    {String(u.position)}
                                                </span>
                                                <span className="ml-3 truncate">{u.name}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="md:col-span-2">
                                {selectedUser ? (
                                    <div>
                                        <h3 className="mb-4 text-lg font-medium">{selectedUser.name} のロール</h3>
                                        <div className="space-y-3">
                                            {roles.map((role) => (
                                                <div key={role.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`role-${role.id}`}
                                                        checked={!!checked[role.id]}
                                                        onCheckedChange={() => setChecked((prev) => ({ ...prev, [role.id]: !prev[role.id] }))}
                                                    />
                                                    <Label htmlFor={`role-${role.id}`} className="font-normal">
                                                        {role.name}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 flex justify-end">
                                            {canUpdateUsers && (
                                                <Button onClick={handleSave} disabled={isSaving}>
                                                    {isSaving ? '保存中...' : '保存'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
                                        左のリストからユーザーを選択してください
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppSidebarLayout>
    );
}
