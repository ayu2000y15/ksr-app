import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Trash } from 'lucide-react';

export default function Index() {
    const page: any = usePage();
    const items = page.props.default_shifts || [];

    const breadcrumbs = [
        { title: '各種設定', href: route('admin.role-permissions') },
        { title: 'デフォルトシフト設定', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="デフォルトシフト設定" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="デフォルトシフト設定" description="曜日ごとの勤務パターンを管理します。" />
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>デフォルトシフト一覧</CardTitle>
                        <Link href={route('admin.default-shifts.create')}>
                            <Button>
                                <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">新規作成</span>
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>パターン名</TableHead>
                                    <TableHead>種別</TableHead>
                                    <TableHead>曜日</TableHead>
                                    <TableHead>勤務帯</TableHead>
                                    <TableHead>開始</TableHead>
                                    <TableHead>終了</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((it: any) => (
                                    <TableRow key={it.id} className="hover:bg-gray-50">
                                        <TableCell
                                            className="cursor-pointer"
                                            onClick={() => router.get(route('admin.default-shifts.edit', it.id), {}, { preserveScroll: true })}
                                        >
                                            {it.id}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer"
                                            onClick={() => router.get(route('admin.default-shifts.edit', it.id), {}, { preserveScroll: true })}
                                        >
                                            {it.name}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer"
                                            onClick={() => router.get(route('admin.default-shifts.edit', it.id), {}, { preserveScroll: true })}
                                        >
                                            {it.type === 'weekday' ? '平日' : it.type === 'holiday' ? '休日' : it.type}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer"
                                            onClick={() => router.get(route('admin.default-shifts.edit', it.id), {}, { preserveScroll: true })}
                                        >
                                            {['日', '月', '火', '水', '木', '金', '土'][it.day_of_week]}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer"
                                            onClick={() => router.get(route('admin.default-shifts.edit', it.id), {}, { preserveScroll: true })}
                                        >
                                            {it.shift_type === 'day' ? '昼' : it.shift_type === 'night' ? '夜' : it.shift_type}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer"
                                            onClick={() => router.get(route('admin.default-shifts.edit', it.id), {}, { preserveScroll: true })}
                                        >
                                            {String(it.start_time).substring(0, 5)}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer"
                                            onClick={() => router.get(route('admin.default-shifts.edit', it.id), {}, { preserveScroll: true })}
                                        >
                                            {String(it.end_time).substring(0, 5)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => {
                                                    if (confirm('本当に削除しますか？')) router.delete(route('admin.default-shifts.destroy', it.id));
                                                }}
                                            >
                                                <Trash className="mr-2 h-4 w-4" /> 削除
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
