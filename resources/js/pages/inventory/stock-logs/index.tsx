import HeadingSmall from '@/components/heading-small';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';

type InventoryItem = { id: number; name?: string; category?: { id: number; name?: string } };
type InventoryStock = { id: number; storage_location?: string; inventory_item?: InventoryItem };
type StockLog = {
    id: number;
    change_date: string;
    inventory_stock?: InventoryStock;
    user?: { id: number; name?: string };
    quantity_before?: number;
    quantity_after?: number;
    reason?: string | null;
};

export default function StockLogs({ logs }: { logs?: StockLog[] | { data: StockLog[] } }) {
    const items: StockLog[] = Array.isArray(logs) ? logs : logs && 'data' in logs ? logs.data : [];
    const page = usePage();
    const queryParams: { sort?: string; direction?: string } = (page.props as any)?.queryParams || {};

    const SortableHeader = ({ children, sort_key }: { children: ReactNode; sort_key: string }) => {
        const currentSort = queryParams?.sort || 'change_date';
        const currentDirection = queryParams?.direction || 'desc';
        const isCurrentSort = currentSort === sort_key;
        const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

        return (
            <Link href={route('inventory.stock_logs.index', { sort: sort_key, direction: newDirection })} preserveState preserveScroll>
                <div className={`flex items-center gap-2 ${isCurrentSort ? 'text-indigo-600' : 'text-muted-foreground'}`}>
                    <span>{children}</span>
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {isCurrentSort ? (
                            currentDirection === 'asc' ? (
                                <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            ) : (
                                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            )
                        ) : (
                            <path
                                d="M5 12l5-5 5 5"
                                stroke="currentColor"
                                strokeWidth="1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.4"
                            />
                        )}
                    </svg>
                </div>
            </Link>
        );
    };
    // format date as yyyy/m/d(曜) h:m:s with no leading zeros
    const formatDateNoLeadingZeros = (dateStr?: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        const y = d.getFullYear();
        const m = d.getMonth() + 1; // no leading zero
        const day = d.getDate(); // no leading zero
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const wd = weekdays[d.getDay()];
        const h = d.getHours();
        const mi = d.getMinutes().toString().padStart(2, '0');
        const s = d.getSeconds().toString().padStart(2, '0');
        return `${y}/${m}/${day}(${wd}) ${h}:${mi}:${s}`;
    };
    const renderDelta = (before?: number | null, after?: number | null) => {
        if (before == null && after == null) return <span className="text-muted-foreground">-</span>;
        const b = typeof before === 'number' ? before : 0;
        const a = typeof after === 'number' ? after : 0;
        const diff = a - b;
        if (diff > 0) {
            return (
                <span className="flex items-center gap-1 text-green-600">
                    <span className="text-sm">▲</span>
                    <span className="text-sm">{diff} 増加</span>
                </span>
            );
        }
        if (diff < 0) {
            return (
                <span className="flex items-center gap-1 text-red-600">
                    <span className="text-sm">▼</span>
                    <span className="text-sm">{Math.abs(diff)} 減少</span>
                </span>
            );
        }
        return <span className="text-muted-foreground">変化なし</span>;
    };
    return (
        <AppSidebarLayout
            breadcrumbs={[
                { title: '在庫管理', href: route('inventory.index') },
                { title: '在庫ログ', href: route('inventory.stock_logs.index') },
            ]}
        >
            <Head title="在庫ログ" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="在庫変動ログ" description="在庫の変動を確認できる。" />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>在庫変動ログ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <div className="space-y-3 md:hidden">
                                {items.map((l) => (
                                    <div key={l.id} className="rounded border bg-white p-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-sm font-medium">{l.inventory_stock?.inventory_item?.name ?? '-'}</div>
                                                <div className="text-xs text-muted-foreground">{l.inventory_stock?.storage_location ?? '-'}</div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">{formatDateNoLeadingZeros(l.change_date)}</div>
                                        </div>
                                        <div className="mt-2 text-sm">
                                            <div>変更者: {l.user?.name ?? '-'}</div>
                                            <div>変更前: {l.quantity_before}</div>
                                            <div>変更後: {l.quantity_after}</div>
                                            <div>増減: {renderDelta(l.quantity_before ?? null, l.quantity_after ?? null)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <SortableHeader sort_key="change_date">日時</SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="category">カテゴリ</SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="inventory_item">アイテム</SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="storage_location">保管場所</SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="user">変更者</SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="quantity_before">変更前</SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="quantity_after">変更後</SortableHeader>
                                            </TableHead>
                                            <TableHead>増減</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((l) => (
                                            <TableRow key={l.id} className="hover:bg-gray-50">
                                                <TableCell>{formatDateNoLeadingZeros(l.change_date)}</TableCell>
                                                <TableCell>{l.inventory_stock?.inventory_item?.category?.name ?? '-'}</TableCell>
                                                <TableCell>{l.inventory_stock?.inventory_item?.name ?? '-'}</TableCell>
                                                <TableCell>{l.inventory_stock?.storage_location ?? '-'}</TableCell>
                                                <TableCell>{l.user?.name ?? '-'}</TableCell>
                                                <TableCell>{l.quantity_before}</TableCell>
                                                <TableCell>{l.quantity_after}</TableCell>
                                                <TableCell>{renderDelta(l.quantity_before ?? null, l.quantity_after ?? null)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
