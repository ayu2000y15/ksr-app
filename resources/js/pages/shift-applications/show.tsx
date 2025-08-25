import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';

const breadcrumbs = [
    { title: '休暇申請', href: route('shift-applications.index') },
    { title: '詳細', href: '' },
];

export default function Show() {
    const pageProps: any = usePage().props;
    const app = pageProps.application;

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={`申請 ${app.id}`} />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>申請の詳細</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>ユーザー</Label>
                                <div className="rounded-md bg-gray-100 p-2">{app.user ? app.user.name : '—'}</div>
                            </div>

                            <div>
                                <Label>期間</Label>
                                <div className="rounded-md bg-gray-100 p-2">
                                    {new Date(app.start_at).toLocaleDateString()} 〜 {new Date(app.end_at).toLocaleDateString()}
                                </div>
                            </div>

                            <div>
                                <Label>理由</Label>
                                <div className="rounded-md bg-gray-100 p-2">{app.reason}</div>
                            </div>

                            <div>
                                <Label>ステータス</Label>
                                <div className="rounded-md bg-gray-100 p-2">{app.status}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-6 flex justify-end">
                        <Link href={route('shift-applications.index')}>
                            <Button variant="outline">一覧に戻る</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
