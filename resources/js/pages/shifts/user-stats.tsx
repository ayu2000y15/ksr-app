declare const route: any;
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'ユーザー別統計', href: route('shifts.user-stats') }];

export default function UserStats(props: any) {
    const page = usePage();
    const users = props.users || (page.props as any).users || [];
    const months = props.months || (page.props as any).months || [];
    const stats = props.stats || (page.props as any).stats || {};
    const today = new Date();

    // 現在の日付が含まれる15日区切りの期間を計算
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();

    // 1-15日の場合は前月、16-31日の場合は当月
    const currentPeriodMonth = currentDay <= 15 ? currentMonth - 1 : currentMonth;
    const currentPeriodYear = currentDay <= 15 && currentMonth === 1 ? currentYear - 1 : currentYear;
    const adjustedMonth = currentPeriodMonth === 0 ? 12 : currentPeriodMonth;
    const adjustedYear = currentPeriodMonth === 0 ? currentYear - 1 : currentPeriodYear;
    const currentMonthKey = `${adjustedYear}-${String(adjustedMonth).padStart(2, '0')}`;

    // 15日区切りの期間表示を生成（YYYY-MM -> YYYY/M/16 〜 YYYY/M/15）
    const formatPeriod = (monthKey: string) => {
        const [year, month] = monthKey.split('-').map(Number);
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        return `${year}/${month}/16 〜 ${nextYear}/${nextMonth}/15`;
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー別統計" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-3 flex items-center justify-between">
                    <HeadingSmall title="ユーザー別統計" description="各ユーザーの月別出勤日数・出勤時間合計を表示します。" />
                    <div className="mt-3">
                        <Link href={route('shifts.index')} className="inline-block">
                            <Button variant="outline">
                                <ArrowLeft className="mr-2 h-4 w-4" /> 戻る
                            </Button>
                        </Link>
                    </div>
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
                                                <div className="text-xs whitespace-nowrap">{formatPeriod(m)}</div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u: any) => (
                                        <TableRow key={u.id} className={u.status === 'retired' ? 'bg-gray-200 text-muted-foreground' : ''}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-14 text-right font-mono text-sm whitespace-pre text-muted-foreground">
                                                        {String(u.position).padStart(4, ' ')}
                                                    </div>
                                                    <Link
                                                        href={route('users.show', u.id)}
                                                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {u.name}
                                                    </Link>
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
                            {users.map((u: any) => (
                                <div
                                    key={u.id}
                                    className={`rounded-lg border p-3 ${u.status === 'retired' ? 'bg-gray-50 text-muted-foreground' : 'bg-white'}`}
                                >
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 text-right font-mono text-sm text-muted-foreground">
                                                {String(u.position).padStart(4, ' ')}
                                            </div>
                                            <Link
                                                href={route('users.show', u.id)}
                                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                {u.name}
                                            </Link>
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
                                                    <div className="text-xs text-muted-foreground">{formatPeriod(m)}</div>
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
                                                            送迎（行き）: <span className="font-medium">{s.transport_requests_to_count ?? 0}件</span>
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
