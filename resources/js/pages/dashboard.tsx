import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ClipboardList, Home, Package, Users, Wrench } from 'lucide-react';

// パンくずリストの定義
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'ダッシュボード',
        href: route('dashboard'),
    },
];

// メニュー項目の定義
const menuItems = [
    { title: 'ユーザー管理', href: route('users.index'), icon: Users },
    { title: 'シフト管理', href: '#', icon: ClipboardList }, // TODO: route('shifts.index')
    { title: '在庫管理', href: '#', icon: Package }, // TODO: route('inventories.index')
    { title: '物件管理', href: '#', icon: Home }, // TODO: route('properties.index')
    { title: '各種設定', href: '#', icon: Wrench }, // TODO: route('settings.index')
];

export default function Dashboard() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ダッシュボード" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {menuItems.map((item) => (
                        <Link href={item.href} key={item.title}>
                            <Card className="transition-colors hover:bg-gray-100">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-lg font-medium">{item.title}</CardTitle>
                                    <item.icon className="h-6 w-6 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{item.title}に関する機能はこちら</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                <div className="mt-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>お知らせ</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>現在、新しいお知らせはありません。</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
