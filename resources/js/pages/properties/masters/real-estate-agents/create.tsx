import HeadingSmall from '@/components/heading-small';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head } from '@inertiajs/react';

export default function Create() {
    return (
        <AppSidebarLayout breadcrumbs={[{ title: '不動産会社マスタ', href: route('properties.masters.real-estate-agents.index') }]}>
            <Head title="不動産会社作成" />
            <div className="p-4 sm:p-6 lg:p-8">
                <HeadingSmall title="不動産会社作成" description="簡易フォーム（後でバリデーションを追加）" />
                <div className="mt-4 rounded border bg-white p-4">
                    <div className="text-sm text-gray-600">フォームをここに作成してください</div>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
