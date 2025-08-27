import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link } from '@inertiajs/react';

export default function Index({ agents }: any) {
    return (
        <AppSidebarLayout breadcrumbs={[{ title: '不動産会社マスタ', href: route('properties.masters.real-estate-agents.index') }]}>
            <Head title="不動産会社マスタ" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6 flex items-center justify-between">
                    <HeadingSmall title="不動産会社マスタ" description="一覧と作成" />
                    <div>
                        <Link href={route('properties.masters.real-estate-agents.create')}>
                            <Button>作成</Button>
                        </Link>
                    </div>
                </div>
                <div className="rounded border bg-white p-4">
                    <ul className="space-y-2 text-sm">
                        {(agents || []).map((a: any) => (
                            <li key={a.id} className="flex items-center justify-between">
                                <div>{a.name}</div>
                                <div className="text-sm text-gray-500">order: {a.order_column}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
