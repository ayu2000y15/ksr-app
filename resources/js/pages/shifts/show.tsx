import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';

const breadcrumbs = [
    { title: 'シフト管理', href: route('shifts.index') },
    { title: '詳細', href: '' },
];

export default function Show() {
    const pageProps: any = usePage().props;
    const shift = pageProps.shift;

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={`シフト ${shift.id}`} />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>シフトの詳細</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>ユーザー</Label>
                                <div className="rounded-md bg-gray-100 p-2">{shift.user ? shift.user.name : '—'}</div>
                            </div>

                            <div>
                                <Label>日時</Label>
                                <div className="rounded-md bg-gray-100 p-2">
                                    {shift.date} {shift.start_time} 〜 {shift.end_time}
                                </div>
                            </div>

                            <div>
                                <Label>メモ</Label>
                                <div className="rounded-md bg-gray-100 p-2">{shift.memo}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-6 flex justify-end">
                        <Link href={route('shifts.index')}>
                            <Button variant="outline">一覧に戻る</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
