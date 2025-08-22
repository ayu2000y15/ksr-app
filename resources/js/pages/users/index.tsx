import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge'; // Badgeコンポーネントをインポート
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem, PageProps, PaginatedResponse, User } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, Plus, Trash } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';

// パンくずリストの定義
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: 'ユーザー管理', href: route('users.index') },
];

// 並び替え可能なテーブルヘッダーのコンポーネント
const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    const Icon = isCurrentSort ? (currentDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
        <Link
            href={route('users.index', { sort: sort_key, direction: newDirection })}
            preserveState
            preserveScroll
            className="flex items-center gap-2"
        >
            {children}
            <Icon className={`h-4 w-4 ${isCurrentSort ? 'text-primary' : 'text-muted-foreground'}`} />
        </Link>
    );
};

export default function Index({ users: initialUsers, queryParams = {} }: PageProps<{ users: PaginatedResponse<User>; queryParams: any }>) {
    const [users, setUsers] = useState(initialUsers.data);
    const [nextPageUrl, setNextPageUrl] = useState(initialUsers.next_page_url);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setUsers(initialUsers.data);
        setNextPageUrl(initialUsers.next_page_url);
    }, [initialUsers]);

    const loadMore = () => {
        if (!nextPageUrl) return;

        setLoading(true);
        router.get(
            nextPageUrl,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    const newUsers = (page.props.users as PaginatedResponse<User>).data;
                    const nextPage = (page.props.users as PaginatedResponse<User>).next_page_url;
                    setUsers((prevUsers) => [...prevUsers, ...newUsers]);
                    setNextPageUrl(nextPage);
                    setLoading(false);
                },
                onError: () => {
                    setLoading(false);
                },
            },
        );
    };

    const confirmAndDelete = (user: User) => {
        if (!confirm(`ユーザー「${user.name}」を削除してもよろしいですか？この操作は取り消せません。`)) {
            return;
        }

        router.delete(route('users.destroy', user.id), {
            preserveState: false,
            onError: () => {},
        });
    };

    // ステータスに応じてBadgeコンポーネントを返す関数
    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">アクティブ</Badge>;
            case 'retired':
                return <Badge variant="secondary">退職</Badge>;
            case 'shared':
                return <Badge variant="default">共有アカウント</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const page = usePage();
    const { permissions } = page.props as any;

    // 権限チェック関数
    const canViewUsers = permissions?.user?.view || permissions?.is_system_admin;
    const canCreateUsers = permissions?.user?.create || permissions?.is_system_admin;
    const canUpdateUsers = permissions?.user?.update || permissions?.is_system_admin;
    const canDeleteUsers = permissions?.user?.delete || permissions?.is_system_admin;

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー管理" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="ユーザー管理" description="ユーザーの一覧・編集・削除を行う。" />
                </div>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>ユーザー一覧</CardTitle>
                        {canCreateUsers && (
                            <Link href={route('users.create')}>
                                <Button>
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">新規作成</span>
                                </Button>
                            </Link>
                        )}
                    </CardHeader>
                    <CardContent>
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
                                            名前
                                        </SortableHeader>
                                    </TableHead>
                                    <TableHead>
                                        <SortableHeader sort_key="email" queryParams={queryParams}>
                                            LINE名
                                        </SortableHeader>
                                    </TableHead>
                                    <TableHead>
                                        <SortableHeader sort_key="status" queryParams={queryParams}>
                                            ステータス
                                        </SortableHeader>
                                    </TableHead>
                                    <TableHead>
                                        <SortableHeader sort_key="created_at" queryParams={queryParams}>
                                            登録日
                                        </SortableHeader>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-gray-50">
                                        <TableCell
                                            className={canUpdateUsers ? 'cursor-pointer' : ''}
                                            onClick={() => canUpdateUsers && router.get(route('users.edit', user.id), {}, { preserveScroll: true })}
                                        >
                                            {user.id}
                                        </TableCell>
                                        <TableCell
                                            className={canUpdateUsers ? 'cursor-pointer' : ''}
                                            onClick={() => canUpdateUsers && router.get(route('users.edit', user.id), {}, { preserveScroll: true })}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span>{user.name}</span>
                                                <span className="text-sm text-muted-foreground">
                                                    {user.roles && user.roles.length > 0 ? (
                                                        user.roles.map((r) => r.name).join(', ')
                                                    ) : (
                                                        <span className="text-xs">未登録</span>
                                                    )}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell
                                            className={canUpdateUsers ? 'cursor-pointer' : ''}
                                            onClick={() => canUpdateUsers && router.get(route('users.edit', user.id), {}, { preserveScroll: true })}
                                        >
                                            {user.line_name}
                                        </TableCell>
                                        <TableCell
                                            className={canUpdateUsers ? 'cursor-pointer' : ''}
                                            onClick={() => canUpdateUsers && router.get(route('users.edit', user.id), {}, { preserveScroll: true })}
                                        >
                                            {renderStatusBadge(user.status)}
                                        </TableCell>
                                        <TableCell
                                            className={canUpdateUsers ? 'cursor-pointer' : ''}
                                            onClick={() => canUpdateUsers && router.get(route('users.edit', user.id), {}, { preserveScroll: true })}
                                        >
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {canDeleteUsers && (
                                                <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(user)}>
                                                    <Trash className="mr-2 h-4 w-4" /> 削除
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {nextPageUrl && (
                            <div className="mt-6 text-center">
                                <Button onClick={loadMore} disabled={loading} variant="outline">
                                    {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    もっとみる
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
