import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';

function formatDate(d: Date) {
    return d.toISOString().slice(0, 10);
}

export default function Index({ properties }: any) {
    const page = usePage();

    const safeRoute = (name: string, fallback: string) => {
        try {
            // @ts-ignore
            return typeof route === 'function' ? route(name) : fallback;
        } catch (e) {
            return fallback;
        }
    };

    // build date range: default to current month
    const { startDate, endDate, days } = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysArr: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            daysArr.push(formatDate(new Date(d)));
        }
        return { startDate: formatDate(start), endDate: formatDate(end), days: daysArr };
    }, []);

    // normalize room occupancies into ranges
    const rows = (properties || []).map((p: any) => {
        const occs = (p.room_occupancies || []).map((o: any) => ({
            id: o.id,
            user_name: o.user ? o.user.name : `user:${o.user_id}`,
            start: o.move_in_date,
            end: o.move_out_date || endDate,
        }));
        return { property: p, occs };
    });

    // compute width percentage per day
    const dayWidth = 100 / days.length;

    return (
        <AppSidebarLayout breadcrumbs={[{ title: '物件管理', href: route('properties.index') }]}>
            <Head title="物件管理" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <HeadingSmall title="物件管理（入退寮）" description={`表示期間: ${startDate} 〜 ${endDate}`} />
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                        <Link href={safeRoute('properties.masters.properties.index', '/properties/masters/properties')}>
                            <Button size="sm" variant="ghost" className="whitespace-nowrap">
                                物件マスタ管理
                            </Button>
                        </Link>
                        <Link href={route('inventory.create')}>
                            <Button className="whitespace-nowrap">
                                <Plus className="mr-2 h-4 w-4" /> 入寮者登録
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="overflow-auto rounded border bg-white">
                    <div className="sticky top-0 border-b bg-gray-50">
                        <div className="grid grid-cols-[240px_1fr] items-center">
                            <div className="px-3 py-2 font-medium">物件名</div>
                            <div className="px-2 py-2">
                                <div className="flex text-xs text-gray-600">
                                    {days.map((d) => (
                                        <div key={d} className="px-1 text-center" style={{ width: `${dayWidth}%`, minWidth: 28 }}>
                                            {d.slice(5)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        {rows.map((r: any) => (
                            <div key={r.property.id} className="grid grid-cols-[240px_1fr] items-start border-t">
                                <div className="px-3 py-3">
                                    <div className="font-medium">{r.property.name}</div>
                                    <div className="text-sm text-gray-500">{r.property.address}</div>
                                </div>
                                <div className="relative h-16 px-2 py-2">
                                    <div className="absolute top-0 right-0 bottom-0 left-0">
                                        <div className="relative h-full">
                                            {r.occs.map((o: any) => {
                                                const sIdx = days.indexOf(o.start);
                                                const eIdx = Math.max(days.indexOf(o.end), sIdx);
                                                const left = (sIdx >= 0 ? sIdx : 0) * dayWidth;
                                                const width = (eIdx - (sIdx >= 0 ? sIdx : 0) + 1) * dayWidth;
                                                return (
                                                    <div
                                                        key={o.id}
                                                        title={`${o.user_name}: ${o.start}〜${o.end}`}
                                                        className="absolute top-3 flex h-8 items-center overflow-hidden rounded bg-sky-500/80 px-2 text-sm text-white shadow-sm"
                                                        style={{ left: `${left}%`, width: `${width}%` }}
                                                    >
                                                        <span className="truncate">{o.user_name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
