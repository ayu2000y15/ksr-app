import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AuthenticatedLayout from '@/layouts/app-layout';
import { PageProps, PaginatedResponse, User } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowUpDown } from 'lucide-react';
import { ReactNode } from 'react';

// 並び替え可能なテーブルヘッダーのコンポーネント
const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    return (
        <Link
            href={route('users.index', { sort: sort_key, direction: newDirection })}
            preserveState
            preserveScroll
            className="flex items-center gap-2"
        >
            {children}
            {isCurrentSort && <ArrowUpDown className="h-4 w-4" />}
        </Link>
    );
};

export default function Index({ auth, users, queryParams = {} }: PageProps<{ users: PaginatedResponse<User>; queryParams: any }>) {
    const { data, links } = users;

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active':
                return 'アクティブ';
            case 'retired':
                return '退職';
            case 'shared':
                return '共有アカウント';
            default:
                return status;
        }
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl leading-tight font-semibold text-gray-800">ユーザー管理</h2>}>
            <Head title="ユーザー管理" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    {' '}
                    {/* 修正: sm-px-6 -> sm:px-6 */}
                    <div className="mb-4 flex justify-end">
                        <Link href={route('users.create')}>
                            <Button>ユーザー新規作成</Button>
                        </Link>
                    </div>
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
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
                                            メールアドレス
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
                                {data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.id}</TableCell>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{getStatusLabel(user.status)}</TableCell>
                                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {/* ページネーション */}
                    <div className="mt-4">
                        <Pagination>
                            <PaginationContent>
                                {links.map((link, index) => (
                                    <PaginationItem key={index} className={link.active ? 'font-bold' : ''}>
                                        <PaginationLink
                                            href={link.url || ''}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                            preserveState
                                            preserveScroll
                                        />
                                    </PaginationItem>
                                ))}
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
