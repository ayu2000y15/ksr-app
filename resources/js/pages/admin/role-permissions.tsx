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

    // グループ化: permission.name の最初の '.' まででグルーピング
    const groupedPermissions = permissions.reduce((acc: Record<string, Permission[]>, perm) => {
        const prefix = perm.name.split('.')[0] || 'その他';
        if (!acc[prefix]) acc[prefix] = [];
        acc[prefix].push(perm);
        return acc;
    }, {});

    // グループキー -> 日本語ラベル
    const GROUP_LABELS: Record<string, string> = {
        user: 'ユーザー',
        role: 'ロール',
        permission: '権限',
        shift: 'シフト管理',
        shift_application: '休暇申請',
        default_shift: 'デフォルトシフト',
        shift_detail: 'シフト詳細',
        user_shift_setting: 'ユーザー別休暇上限',
        inventory: '在庫管理',
        damaged_inventory: '破損在庫管理',
        その他: 'その他',
        properties: '物件管理',
        // 必要に応じてここに追加
    };

    // 個別の permission.name -> 日本語ラベル
    const PERMISSION_LABELS: Record<string, string> = {
        // user
        'user.view': 'ユーザー閲覧',
        'user.create': 'ユーザー作成',
        'user.update': 'ユーザー編集',
        'user.delete': 'ユーザー削除',
        // role & permission
        'role.viewAny': 'ロール一覧閲覧',
        'role.view': 'ロール閲覧',
        'role.create': 'ロール作成',
        'role.update': 'ロール編集',
        'role.delete': 'ロール削除',
        'role.assign': 'ロール割当',
        'permission.view': '権限閲覧',
        'permission.create': '権限作成',
        'permission.update': '権限編集',
        'permission.delete': '権限削除',
        // shift
        'shift.view': 'シフト閲覧',
        'shift.create': 'シフト作成',
        'shift.update': 'シフト編集',
        'shift.delete': 'シフト削除',
        'shift.viewAny': 'シフト一覧閲覧',
        'shift.manage': 'シフト管理',
        // shift details
        'shift_detail.view': 'シフト詳細閲覧',
        'shift_detail.create': 'シフト詳細作成',
        'shift_detail.update': 'シフト詳細編集',
        'shift_detail.delete': 'シフト詳細削除',
        // shift application
        'shift_application.view': '休暇申請閲覧',
        'shift_application.create': '休暇申請作成',
        'shift_application.update': '休暇申請編集',
        'shift_application.delete': '休暇申請削除',
        // default shifts
        'default_shift.view': 'デフォルトシフト閲覧',
        'default_shift.create': 'デフォルトシフト作成',
        'default_shift.update': 'デフォルトシフト編集',
        'default_shift.delete': 'デフォルトシフト削除',
        // user shift setting
        'user_shift_setting.view': 'ユーザー休暇上限閲覧',
        'user_shift_setting.create': 'ユーザー休暇上限作成',
        'user_shift_setting.update': 'ユーザー休暇上限編集',
        'user_shift_setting.delete': 'ユーザー休暇上限削除',
        // inventory
        'inventory.view': '在庫閲覧',
        'inventory.create': '在庫作成',
        'inventory.update': '在庫編集',
        'inventory.delete': '在庫削除',
        'inventory.log.view': '在庫ログ閲覧',
        // damaged inventory
        'damaged_inventory.view': '破損在庫閲覧',
        'damaged_inventory.create': '破損在庫作成',
        'damaged_inventory.update': '破損在庫編集',
        'damaged_inventory.delete': '破損在庫削除',
        'damaged_inventory.log.view': '破損在庫ログ閲覧',
        // properties
        'properties.view': '物件閲覧',
        'properties.create': '物件作成',
        'properties.edit': '物件編集',
        'properties.delete': '物件削除',
        'properties.reorder': '物件並び替え',
    };

    const allSelected = permissions.length > 0 && permissions.every((p) => !!checked[p.id]);

    const toggleAll = (value: boolean) => {
        const map: Record<number, boolean> = {};
        permissions.forEach((p) => (map[p.id] = value));
        setChecked(map);
    };

    const toggleGroup = (groupKey: string, value: boolean) => {
        setChecked((prev) => {
            const next = { ...prev };
            (groupedPermissions[groupKey] || []).forEach((p) => {
                next[p.id] = value;
            });
            return next;
        });
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
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="text-lg font-medium">{selectedRole.name} の権限</h3>
                                            <div className="flex items-center space-x-4">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id={`select-all`} checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                                                    <Label htmlFor={`select-all`} className="font-normal">
                                                        全て選択
                                                    </Label>
                                                </div>
                                                {can('role.update') && (
                                                    <Button onClick={handleSave} disabled={isSaving}>
                                                        {isSaving ? '保存中...' : '保存'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {Object.keys(groupedPermissions).map((groupKey) => {
                                                const group = groupedPermissions[groupKey];
                                                const groupChecked = group.every((p) => !!checked[p.id]);
                                                const groupSome = group.some((p) => !!checked[p.id]);

                                                return (
                                                    <div key={groupKey} className="rounded border p-3">
                                                        <div className="mb-2 flex items-center justify-between rounded bg-gray-100 p-2">
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`group-${groupKey}`}
                                                                    checked={groupChecked}
                                                                    onCheckedChange={(v) => toggleGroup(groupKey, !!v)}
                                                                />
                                                                <div className="flex items-center space-x-2">
                                                                    <Label htmlFor={`group-${groupKey}`} className="font-medium text-gray-800">
                                                                        {GROUP_LABELS[groupKey] || groupKey}
                                                                    </Label>
                                                                    {groupSome && !groupChecked && (
                                                                        <span className="text-sm text-muted-foreground">(一部選択)</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">{group.length} 件</div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                            {group.map((perm) => (
                                                                <div key={perm.id} className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                        id={`perm-${perm.id}`}
                                                                        checked={!!checked[perm.id]}
                                                                        onCheckedChange={() =>
                                                                            setChecked((prev) => ({ ...prev, [perm.id]: !prev[perm.id] }))
                                                                        }
                                                                    />
                                                                    <Label htmlFor={`perm-${perm.id}`} className="font-normal">
                                                                        {PERMISSION_LABELS[perm.name] || perm.name}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
