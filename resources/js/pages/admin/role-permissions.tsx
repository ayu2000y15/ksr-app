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
import { BreadcrumbItem, Permission, Role } from '@/types';

// パンくずリストの定義
const breadcrumbs: BreadcrumbItem[] = [
    { title: '各種設定', href: '#' },
    { title: 'ロールへの権限割り当て', href: route('admin.role-permissions') },
];

export default function RolePermissionsPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [checked, setChecked] = useState<Record<number, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchRoles();
        fetchPermissions();
    }, []);

    const fetchRoles = async () => {
        const res = await axios.get('/api/roles');
        setRoles(res.data);
    };
    const fetchPermissions = async () => {
        const res = await axios.get('/api/permissions');
        setPermissions(res.data);
    };

    const handleRoleSelect = (roleId: number) => {
        const role = roles.find((r) => r.id === roleId) || null;
        setSelectedRole(role);
        const map: Record<number, boolean> = {};
        (role?.permissions || []).forEach((p) => {
            map[p.id] = true;
        });
        setChecked(map);
    };

    const handleSave = async () => {
        if (!selectedRole) return;
        setIsSaving(true);
        const permission_ids = Object.keys(checked)
            .filter((id) => checked[Number(id)])
            .map(Number);

        await axios.post(`/api/roles/${selectedRole.id}/permissions`, { permission_ids });

        await fetchRoles(); // ロールリストを再取得してリレーションを更新
        setIsSaving(false);
        setToast({ message: '保存しました', type: 'success' });
    };

    const page = usePage();
    const authProps = page.props?.auth as unknown as { permissions?: string[] } | undefined;
    const authPermissions: string[] = authProps?.permissions ?? [];
    const can = (perm: string) => authPermissions.includes(perm);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ロールへの権限割り当て" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <Heading title="ロールへの権限割り当て" description="各役割（ロール）にどの操作を許可（権限）するかを設定する。" />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>権限の関連付け</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="rounded-md border">
                                <div className="border-b p-2 font-semibold">ロール</div>
                                <ul className="max-h-96 overflow-y-auto">
                                    {roles.map((r) => (
                                        <li
                                            key={r.id}
                                            className={`cursor-pointer p-2 text-sm hover:bg-muted/50 ${selectedRole?.id === r.id ? 'bg-muted' : ''}`}
                                            onClick={() => handleRoleSelect(r.id)}
                                        >
                                            {r.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="md:col-span-2">
                                {selectedRole ? (
                                    <div>
                                        <h3 className="mb-4 text-lg font-medium">{selectedRole.name} の権限</h3>
                                        <div className="space-y-3">
                                            {permissions.map((perm) => (
                                                <div key={perm.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`perm-${perm.id}`}
                                                        checked={!!checked[perm.id]}
                                                        onCheckedChange={() => setChecked((prev) => ({ ...prev, [perm.id]: !prev[perm.id] }))}
                                                    />
                                                    <Label htmlFor={`perm-${perm.id}`} className="font-normal">
                                                        {perm.name}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 flex justify-end">
                                            {can('role.update') && (
                                                <Button onClick={handleSave} disabled={isSaving}>
                                                    {isSaving ? '保存中...' : '保存'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
                                        左のリストからロールを選択してください
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
