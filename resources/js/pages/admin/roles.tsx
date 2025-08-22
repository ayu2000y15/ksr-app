import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem, Role } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Edit, Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';

// パンくずリストの定義
const breadcrumbs: BreadcrumbItem[] = [
    { title: '各種設定', href: '#' },
    { title: 'ロール管理', href: route('admin.roles') },
];

export default function RoleListPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const page = usePage();
    const { permissions } = page.props as any;

    // 権限チェック関数
    const canViewRoles = permissions?.role?.view || permissions?.is_system_admin;
    const canCreateRoles = permissions?.role?.create || permissions?.is_system_admin;
    const canUpdateRoles = permissions?.role?.update || permissions?.is_system_admin;
    const canDeleteRoles = permissions?.role?.delete || permissions?.is_system_admin;

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        const res = await axios.get('/api/roles');
        setRoles(res.data);
    };

    // Drag-and-drop disabled: functions removed to prevent accidental reordering in this build

    const confirmAndDelete = async (role: Role) => {
        if (window.confirm(`ロール「${role.name}」を削除しますか？`)) {
            await axios.delete(`/api/roles/${role.id}`);
            fetchRoles();
            // TODO: トースト通知
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ロール管理" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <Heading title="ロール管理" description="ユーザーの役割（管理者、一般など）を定義する。" />
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>ロール一覧</CardTitle>
                        {canCreateRoles && (
                            <Link href={route('admin.roles') + '/create'}>
                                <Button>
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">新規ロール</span>
                                </Button>
                            </Link>
                        )}
                    </CardHeader>

                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {/* <TableHead className="w-8" /> */}
                                    <TableHead>id</TableHead>
                                    <TableHead>名前</TableHead>
                                    {/* <TableHead>説明</TableHead> */}
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {roles.map((role) => (
                                    <TableRow key={role.id}>
                                        {/* <TableCell className="w-8">
                                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                                        </TableCell> */}
                                        {/* <TableCell className="w-12">
                                            {typeof role.order_column !== 'undefined' ? role.order_column + 1 : idx + 1}
                                        </TableCell> */}
                                        <TableCell>{role.id}</TableCell>
                                        <TableCell>{role.name}</TableCell>
                                        {/* <TableCell>{role.description}</TableCell> */}
                                        <TableCell className="text-right">
                                            {canUpdateRoles && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mr-2"
                                                    onClick={() => router.get(route('admin.roles') + `/${role.id}/edit`)}
                                                >
                                                    <Edit className="mr-2 h-4 w-4" /> 編集
                                                </Button>
                                            )}
                                            {canDeleteRoles && (
                                                <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(role)}>
                                                    <Trash className="mr-2 h-4 w-4" /> 削除
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
