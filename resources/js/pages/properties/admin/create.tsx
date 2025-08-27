import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link } from '@inertiajs/react';

export default function Create() {
    return (
        <AppSidebarLayout breadcrumbs={[{ title: '物件マスタ管理', href: route('properties.admin') }]}>
            <Head title="物件マスタ作成" />
            <div className="p-4 sm:p-6 lg:p-8">
                <HeadingSmall title="物件マスタ作成" description="簡易フォーム（後でバリデーションを追加）" />
                <div className="mt-4 rounded border bg-white p-4">
                    <div className="text-sm text-gray-600">フォームをここに作成してください</div>
                    <div className="mt-4">
                        <Link href={route('properties.admin')}>
                            <Button>戻る</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
