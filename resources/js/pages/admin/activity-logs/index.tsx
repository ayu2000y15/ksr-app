import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type Activity, type BreadcrumbItem, type PageProps, type PaginatedResponse } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import React from 'react';

// パンくずリスト
const breadcrumbs: BreadcrumbItem[] = [
    { title: '各種設定', href: '#' },
    { title: '活動ログ', href: route('admin.activity-logs') },
];

export default function ActivityLogsIndex() {
    const page = usePage<PageProps<Record<string, unknown>>>();
    const props = page.props as PageProps<Record<string, unknown>> & { activities?: PaginatedResponse<Activity> };

    // activities は props.activities を参照して初期データを作成するための参照を持っています

    // client-side state for load-more behavior
    const initialItems: Activity[] = (props.activities && (props.activities.data as Activity[])) || [];
    const [items, setItems] = React.useState<Activity[]>(initialItems);
    const [currentPage, setCurrentPage] = React.useState<number>((props.activities && (props.activities.current_page as number)) || 1);
    const [lastPage, setLastPage] = React.useState<number>((props.activities && (props.activities.last_page as number)) || 1);
    const [loadingMore, setLoadingMore] = React.useState(false);

    // ISO 日時文字列を日本時間に変換して yyyy/mm/dd hh:mi:ss 形式で返す
    const formatJST = (iso?: string): string => {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(d);
        const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
        return `${map.year}/${map.month}/${map.day} ${map.hour}:${map.minute}:${map.second}`;
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="活動ログ" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <Heading title="活動ログ" description="モデルの変更履歴を表示（変更前後の値を含む）" />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>活動ログ一覧</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>日時</TableHead>
                                    <TableHead>操作者</TableHead>
                                    <TableHead>イベント</TableHead>
                                    <TableHead>対象</TableHead>
                                    <TableHead>詳細</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {items.map((a) => (
                                    <TableRow key={a.id}>
                                        <TableCell className="text-sm text-gray-500">{formatJST(a.created_at)}</TableCell>
                                        <TableCell>
                                            {(() => {
                                                if (!a.causer) return '-';
                                                // causer may be User or a minimal object with id/name
                                                if ('name' in a.causer && a.causer.name) return a.causer.name;
                                                return (a.causer as { id?: number }).id ?? 'user';
                                            })()}
                                        </TableCell>
                                        <TableCell>{a.description}</TableCell>
                                        <TableCell>{a.subject_type ? `${a.subject_type.split('\\').pop()} #${a.subject_id}` : '-'}</TableCell>
                                        <TableCell>
                                            <details>
                                                <summary className="cursor-pointer text-blue-600">表示</summary>
                                                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(a.properties, null, 2)}</pre>
                                            </details>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* もっと見るボタン（ダッシュボードと同様の挙動） */}
                        <div className="mt-4 flex items-center justify-center">
                            {currentPage < lastPage ? (
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        const next = currentPage + 1;
                                        try {
                                            setLoadingMore(true);
                                            const res = await axios.get('/admin/activity-logs', { params: { page: next, per_page: 25 } });
                                            const newItems: Activity[] = (res.data && res.data.activities) || [];
                                            setItems((cur) => cur.concat(newItems));
                                            setCurrentPage(next);
                                            if (res.data && res.data.meta && typeof res.data.meta.last_page === 'number') {
                                                setLastPage(res.data.meta.last_page);
                                            }
                                        } catch {
                                            // ignore
                                        } finally {
                                            setLoadingMore(false);
                                        }
                                    }}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? '読み込み中...' : 'もっとみる'}
                                </Button>
                            ) : (
                                <div className="text-sm text-muted-foreground">これ以上、ログはありません</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
