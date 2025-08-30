declare const route: any;
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'シフト管理', href: route('shifts.index') },
    { title: 'ユーザー別統計', href: route('shifts.user-stats') },
];

export default function UserStats(props: any) {
    const page = usePage();
    const users = props.users || (page.props as any).users || [];
    const months = props.months || (page.props as any).months || [];
    const stats = props.stats || (page.props as any).stats || {};
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー別統計" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="my-6">
                    <HeadingSmall title="ユーザー統計" description="各ユーザーの月別出勤日数・出勤時間合計を表示します。" />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>ユーザー別 月次集計（直近6ヶ月）</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Desktop/tablet view */}
                        <div className="hidden overflow-x-auto md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ユーザー名</TableHead>
                                        {months.map((m: string) => (
                                            <TableHead key={m} className={`${m === currentMonthKey ? 'bg-yellow-50' : ''} border-l border-gray-200`}>
                                                {m}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users
                                        .slice()
                                        .sort((a: any, b: any) => (a.id || 0) - (b.id || 0))
                                        .map((u: any) => (
                                            <TableRow key={u.id} className={u.status === 'retired' ? 'bg-gray-200 text-muted-foreground' : ''}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-14 text-right font-mono text-sm whitespace-pre text-muted-foreground">
                                                            {String(u.id).padStart(4, ' ')}
                                                        </div>
                                                        <div className="font-medium">{u.name}</div>
                                                        {u.status === 'retired' && <Badge className="bg-red-100 text-red-800">退職</Badge>}
                                                    </div>
                                                </TableCell>
                                                {months.map((m: string) => {
                                                    const s = (stats && stats[u.id] && stats[u.id][m]) || {
                                                        days: 0,
                                                        minutes: 0,
                                                        work_minutes: 0,
                                                        break_minutes: 0,
                                                    };
                                                    const hours = Math.floor(s.minutes / 60);
                                                    const mins = s.minutes % 60;
                                                    const scheduledTotal = s.scheduled_work_minutes || 0;
                                                    const sHours = Math.floor(scheduledTotal / 60);
                                                    const sMins = scheduledTotal % 60;
                                                    const workTotal = (s.work_minutes ?? s.scheduled_work_minutes) || 0;
                                                    const wHours = Math.floor(workTotal / 60);
                                                    const wMins = workTotal % 60;
                                                    const breakMinutes = (s.break_minutes ?? s.scheduled_break_minutes) || 0;
                                                    const bHours = Math.floor(breakMinutes / 60);
                                                    const bMins = breakMinutes % 60;
                                                    const cellClass = `${m === currentMonthKey ? 'bg-yellow-50' : ''} border-l border-gray-200`;
                                                    return (
                                                        <TableCell key={m} className={cellClass}>
                                                            <div className="mb-1 text-sm font-medium">{s.days}日</div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                <div className="text-muted-foreground">予定</div>
                                                                <div className="text-right font-medium">
                                                                    {sHours}時間{sMins}分
                                                                </div>

                                                                <div className="text-muted-foreground">拘束</div>
                                                                <div className="text-right font-medium">
                                                                    {wHours}時間{wMins}分
                                                                </div>

                                                                <div className="text-muted-foreground">稼働</div>
                                                                <div className="text-right font-medium">
                                                                    {hours}時間{mins}分
                                                                </div>

                                                                <div className="text-muted-foreground">休憩</div>
                                                                <div className="text-right font-medium">
                                                                    {bHours}時間{bMins}分
                                                                </div>

                                                                <div className="text-muted-foreground">欠席</div>
                                                                <div className="text-right font-medium">{s.absent_count ?? 0}回</div>

                                                                <div className="text-muted-foreground">送迎（行き）</div>
                                                                <div className="text-right font-medium">{s.transport_requests_to_count ?? 0}回</div>

                                                                <div className="text-muted-foreground">送迎（帰り）</div>
                                                                <div className="text-right font-medium">{s.transport_requests_from_count ?? 0}回</div>
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile view: stacked cards */}
                        <div className="space-y-3 md:hidden">
                            {users
                                .slice()
                                .sort((a: any, b: any) => (a.id || 0) - (b.id || 0))
                                .map((u: any) => (
                                    <div
                                        key={u.id}
                                        className={`rounded-lg border p-3 ${u.status === 'retired' ? 'bg-gray-50 text-muted-foreground' : 'bg-white'}`}
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 text-right font-mono text-sm text-muted-foreground">
                                                    {String(u.id).padStart(4, ' ')}
                                                </div>
                                                <div className="font-medium">{u.name}</div>
                                            </div>
                                            {u.status === 'retired' && <Badge className="bg-red-100 text-red-800">退職</Badge>}
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {months.map((m: string) => {
                                                const s = (stats && stats[u.id] && stats[u.id][m]) || { days: 0, minutes: 0 };
                                                const hours = Math.floor(s.minutes / 60);
                                                const mins = s.minutes % 60;
                                                const scheduledTotal = s.scheduled_work_minutes || 0;
                                                const sHours = Math.floor(scheduledTotal / 60);
                                                const sMins = scheduledTotal % 60;
                                                return (
                                                    <div
                                                        key={m}
                                                        className={`flex items-center justify-between text-sm ${m === currentMonthKey ? 'bg-yellow-50' : ''} rounded p-2`}
                                                    >
                                                        <div className="text-xs text-muted-foreground">{m}</div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-muted-foreground">
                                                                予定:{' '}
                                                                <span className="font-medium">
                                                                    {sHours}時間{sMins}分
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                稼働:{' '}
                                                                <span className="font-medium">
                                                                    {hours}時間{mins}分
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                欠席: <span className="font-medium">{s.absent_count ?? 0}回</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                送迎（行き）:{' '}
                                                                <span className="font-medium">{s.transport_requests_to_count ?? 0}件</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                送迎（帰り）:{' '}
                                                                <span className="font-medium">{s.transport_requests_from_count ?? 0}件</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
