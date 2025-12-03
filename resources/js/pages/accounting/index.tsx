declare const route: any;
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { BarChart3, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: '経理向け', href: route('accounting.index') }];

type Holiday = {
    date: string; // YYYY-MM-DD
    name: string;
};

type DailySummary = {
    [date: string]: {
        count: number;
        users: string[];
    };
};

type ShiftDetail = {
    user_id: number;
    user_name: string;
    user_position: number | string;
    work_minutes: number;
    work_periods: { start: string; end: string }[];
    break_minutes: number;
    break_periods: { start: string; end: string }[];
};

type DailyDetailResponse = {
    date: string;
    shifts: ShiftDetail[];
};

export default function AccountingIndex(props: any) {
    const page = usePage();
    const monthProp = (props.month || (page.props as any).month) as string; // YYYY-MM-DD
    const holidays = ((props.holidays || (page.props as any).holidays) as Holiday[]) ?? [];
    const dailySummary = ((props.dailySummary || (page.props as any).dailySummary) as DailySummary) ?? {};

    const [currentMonth, setCurrentMonth] = useState(new Date(monthProp));
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<DailyDetailResponse | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // カレンダー用の日付配列を生成（月曜始まり）
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay(); // 0=日, 1=月, ...
        const daysInMonth = lastDay.getDate();

        const days: (Date | null)[] = [];
        // 月曜始まりに調整（日曜=0を6に、月曜=1を0に変換）
        const adjustedStart = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        // 前月の余白
        for (let i = 0; i < adjustedStart; i++) {
            days.push(null);
        }
        // 当月の日付
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(new Date(year, month, d));
        }
        // 後月の余白（週の最後まで埋める）
        while (days.length % 7 !== 0) {
            days.push(null);
        }
        return days;
    }, [currentMonth]);

    // 祝日マップ
    const holidayMap = useMemo(() => {
        const map: { [date: string]: string } = {};
        holidays.forEach((h) => {
            map[h.date] = h.name;
        });
        return map;
    }, [holidays]);

    // 月変更ハンドラ
    const handlePrevMonth = () => {
        const prev = new Date(currentMonth);
        prev.setMonth(prev.getMonth() - 1);
        const monthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
        router.get(route('accounting.index'), { month: monthStr }, { preserveState: true, preserveScroll: true });
    };

    const handleNextMonth = () => {
        const next = new Date(currentMonth);
        next.setMonth(next.getMonth() + 1);
        const monthStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
        router.get(route('accounting.index'), { month: monthStr }, { preserveState: true, preserveScroll: true });
    };

    const handleToday = () => {
        const today = new Date();
        const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        router.get(route('accounting.index'), { month: monthStr }, { preserveState: true, preserveScroll: true });
    };

    useEffect(() => {
        setCurrentMonth(new Date(monthProp));
    }, [monthProp]);

    // 日付の詳細を取得
    const handleOpenDetail = async (date: string) => {
        setSelectedDate(date);
        setLoadingDetail(true);
        setDetailData(null);
        try {
            const res = await axios.get<DailyDetailResponse>(route('accounting.daily_detail'), { params: { date } });
            setDetailData(res.data);
        } catch (err) {
            console.error(err);
            alert('詳細データの取得に失敗しました');
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleCloseDetail = () => {
        setSelectedDate(null);
        setDetailData(null);
    };

    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const isToday = (d: Date) => {
        const today = new Date();
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    };

    const isWeekend = (d: Date) => {
        const dow = d.getDay();
        return dow === 0 || dow === 6;
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="経理向け" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="経理向け" description="月間カレンダーで各日の勤務データを確認できます。" />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>
                                {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleToday}>
                                    今月
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button variant="default" size="sm" onClick={() => router.visit(route('shifts.user-stats'))} className="ml-2">
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">ユーザー別統計</span>
                                    <span className="sm:hidden">統計</span>
                                </Button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* カレンダーグリッド */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* 曜日ヘッダー（月曜始まり） */}
                            {['月', '火', '水', '木', '金', '土', '日'].map((dow, i) => (
                                <div
                                    key={i}
                                    className={`p-2 text-center text-sm font-semibold ${
                                        i === 5 ? 'text-blue-600' : i === 6 ? 'text-red-600' : 'text-muted-foreground'
                                    }`}
                                >
                                    {dow}
                                </div>
                            ))}

                            {/* 日付セル */}
                            {calendarDays.map((d, idx) => {
                                if (!d) {
                                    return <div key={idx} className="min-h-[120px] rounded border border-transparent bg-gray-50" />;
                                }
                                const dateStr = formatDate(d);
                                const summary = dailySummary[dateStr];
                                const holiday = holidayMap[dateStr];
                                const isTodayCell = isToday(d);
                                const dayOfWeek = d.getDay();
                                const isSaturday = dayOfWeek === 6;
                                const isSunday = dayOfWeek === 0;

                                // 背景色の優先順位: 今日 > 祝日 > 土曜 > 日曜 > 平日
                                let bgClass = 'bg-white';
                                let borderClass = 'border-gray-200';

                                if (isTodayCell) {
                                    bgClass = 'bg-indigo-50';
                                    borderClass = 'border-indigo-500';
                                } else if (holiday) {
                                    bgClass = 'bg-green-50';
                                    borderClass = 'border-green-200';
                                } else if (isSaturday) {
                                    bgClass = 'bg-blue-50';
                                    borderClass = 'border-blue-200';
                                } else if (isSunday) {
                                    bgClass = 'bg-red-50';
                                    borderClass = 'border-red-200';
                                }

                                return (
                                    <div key={idx} className={`relative min-h-[120px] rounded border p-2 ${borderClass} ${bgClass}`}>
                                        <div className="flex items-start justify-between">
                                            <span
                                                className={`text-sm font-medium ${
                                                    isTodayCell
                                                        ? 'text-indigo-700'
                                                        : holiday
                                                          ? 'text-red-600'
                                                          : d.getDay() === 0
                                                            ? 'text-red-600'
                                                            : d.getDay() === 6
                                                              ? 'text-blue-600'
                                                              : 'text-foreground'
                                                }`}
                                            >
                                                {d.getDate()}
                                            </span>
                                        </div>
                                        {holiday && <div className="mt-1 text-xs text-red-600">{holiday}</div>}
                                        {summary && (
                                            <div className="mt-2">
                                                <Badge variant="outline" className="mb-2 text-xs">
                                                    出勤 {summary.count}人
                                                </Badge>
                                                {/* 当日以降は詳細ボタンを非表示 */}
                                                {!isTodayCell && d < new Date() && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full text-xs"
                                                        onClick={() => handleOpenDetail(dateStr)}
                                                    >
                                                        <Eye className="mr-1 h-3 w-3" /> 詳細
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 日別詳細ダイアログ */}
            <Dialog open={!!selectedDate} onOpenChange={(open) => !open && handleCloseDetail()}>
                <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>勤務詳細 - {selectedDate}</DialogTitle>
                        <DialogDescription>各ユーザーの出勤時刻・退勤時刻・休憩時間を表示します。</DialogDescription>
                    </DialogHeader>

                    {loadingDetail && <div className="p-4 text-center text-muted-foreground">読み込み中...</div>}

                    {!loadingDetail && detailData && detailData.shifts.length === 0 && (
                        <div className="p-4 text-center text-muted-foreground">この日の勤務データはありません。</div>
                    )}

                    {!loadingDetail && detailData && detailData.shifts.length > 0 && (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>氏名</TableHead>
                                        <TableHead>出勤時間</TableHead>
                                        <TableHead>休憩時間</TableHead>
                                        <TableHead>稼働時間</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {detailData.shifts.map((shift) => {
                                        const workHours = Math.floor(shift.work_minutes / 60);
                                        const workMins = shift.work_minutes % 60;
                                        const breakHours = Math.floor(shift.break_minutes / 60);
                                        const breakMins = shift.break_minutes % 60;
                                        const actualWorkMinutes = shift.work_minutes - shift.break_minutes;
                                        const actualWorkHours = Math.floor(actualWorkMinutes / 60);
                                        const actualWorkMins = actualWorkMinutes % 60;

                                        return (
                                            <TableRow key={shift.user_id}>
                                                <TableCell>{shift.user_position}</TableCell>
                                                <TableCell className="font-medium">{shift.user_name}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-1 text-sm">
                                                        {shift.work_periods.map((p, i) => (
                                                            <div key={i}>
                                                                {p.start} 〜 {p.end}
                                                            </div>
                                                        ))}
                                                        <div className="text-xs text-muted-foreground">
                                                            合計: {workHours}時間{workMins}分
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1 text-sm">
                                                        {shift.break_periods.length > 0 ? (
                                                            <>
                                                                {shift.break_periods.map((p, i) => (
                                                                    <div key={i}>
                                                                        {p.start} 〜 {p.end}
                                                                    </div>
                                                                ))}
                                                                <div className="text-xs text-muted-foreground">
                                                                    合計: {breakHours}時間{breakMins}分
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium">
                                                        {actualWorkHours}時間{actualWorkMins}分
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppSidebarLayout>
    );
}
