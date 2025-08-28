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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ユーザー名</TableHead>
                                    {months.map((m: string, idx: number) => (
                                        <TableHead key={m} className="border-l border-gray-300">
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
                                                    {/* fixed-width monospace ID so names align */}
                                                    <div className="w-14 text-right font-mono text-sm whitespace-pre text-muted-foreground">
                                                        {String(u.id).padStart(4, ' ')}
                                                    </div>
                                                    <div className="font-medium">{u.name}</div>
                                                    {u.status === 'retired' && <Badge className="bg-red-100 text-red-800">退職</Badge>}
                                                </div>
                                            </TableCell>
                                            {months.map((m: string, idx: number) => {
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
                                                const cellClass = `${m === currentMonthKey ? 'bg-yellow-50' : ''} border-l border-gray-300`;
                                                return (
                                                    <TableCell key={m} className={cellClass}>
                                                        <div className="mb-1 text-sm font-medium">出勤日数：{s.days}日</div>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                            <div className="text-muted-foreground">予定</div>
                                                            <div className="text-right">
                                                                {sHours}時間{sMins}分
                                                            </div>

                                                            <div className="text-muted-foreground">拘束</div>
                                                            <div className="text-right">
                                                                {wHours}時間{wMins}分
                                                            </div>

                                                            <div className="text-muted-foreground">稼働</div>
                                                            <div className="text-right">
                                                                {hours}時間{mins}分
                                                            </div>

                                                            <div className="text-muted-foreground">休憩</div>
                                                            <div className="text-right">
                                                                {bHours}時間{bMins}分
                                                            </div>

                                                            <div className="text-muted-foreground">欠席</div>
                                                            <div className="text-right">{s.absent_count ?? 0}回</div>
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
