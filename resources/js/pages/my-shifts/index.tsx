import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: '自分のシフト', href: '' },
];

export default function MyShifts() {
    const page = usePage();
    const props = page.props as any;
    const auth = props.auth as any;

    // Get shifts data from props
    const shifts = (props.shifts || []) as any[];
    const holidays = (props.holidays || []) as any[];
    const publishedDates = (props.publishedDates || []) as string[];
    const month = props.month ? new Date(props.month) : new Date();

    const publishedDatesSet = useMemo(() => new Set(publishedDates), [publishedDates]);

    const [currentYear, setCurrentYear] = useState(month.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(month.getMonth());
    const [tooltipOpen, setTooltipOpen] = useState<Record<string, boolean>>({});

    // Generate days for the current month (Monday start)
    const { daysInMonth, firstDayOfWeek, prevMonthDays, nextMonthDays } = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        // Convert to Monday-start: 0=Mon, 1=Tue, ..., 6=Sun
        const dayOfWeek = firstDay.getDay();
        const firstDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        // Previous month padding
        const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
        const prevMonthDays = Array.from({ length: firstDayOfWeek }, (_, i) => prevMonthLastDay - firstDayOfWeek + i + 1);

        // Next month padding (to fill the last week)
        const totalCells = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;
        const nextMonthDays = Array.from({ length: totalCells - daysInMonth - firstDayOfWeek }, (_, i) => i + 1);

        return { daysInMonth, firstDayOfWeek, prevMonthDays, nextMonthDays };
    }, [currentYear, currentMonth]);

    // Create a map of shifts by date
    const shiftsByDate = useMemo(() => {
        const map: Record<string, any[]> = {};
        shifts.forEach((shift: any) => {
            const date = shift.date ? new Date(shift.date) : null;
            if (!date) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!map[key]) map[key] = [];
            map[key].push(shift);
        });
        return map;
    }, [shifts]);

    // Create a map of holidays by date
    const holidayMap = useMemo(() => {
        const map: Record<string, string> = {};
        holidays.forEach((h: any) => {
            map[h.date] = h.name;
        });
        return map;
    }, [holidays]);

    const handlePrevMonth = () => {
        let newYear = currentYear;
        let newMonth = currentMonth - 1;
        if (newMonth < 0) {
            newYear -= 1;
            newMonth = 11;
        }
        setCurrentYear(newYear);
        setCurrentMonth(newMonth);
        const monthParam = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`;
        router.get(route('my-shifts.index'), { month: monthParam }, { preserveState: false });
    };

    const handleNextMonth = () => {
        let newYear = currentYear;
        let newMonth = currentMonth + 1;
        if (newMonth > 11) {
            newYear += 1;
            newMonth = 0;
        }
        setCurrentYear(newYear);
        setCurrentMonth(newMonth);
        const monthParam = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`;
        router.get(route('my-shifts.index'), { month: monthParam }, { preserveState: false });
    };

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="自分のシフト" />
            <div className="p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-lg sm:text-xl">{auth?.user?.name || '自分'}のシフト</CardTitle>
                            <div className="flex items-center justify-center gap-2">
                                <Button size="sm" variant="outline" onClick={handlePrevMonth}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="min-w-[100px] text-center text-base font-medium sm:min-w-[120px] sm:text-lg">
                                    {currentYear}年{currentMonth + 1}月
                                </div>
                                <Button size="sm" variant="outline" onClick={handleNextMonth}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-7 gap-1">
                            {/* Header - Week days */}
                            {weekDays.map((day, idx) => (
                                <div
                                    key={day}
                                    className={`p-1 text-center text-xs font-semibold sm:p-2 sm:text-sm ${
                                        idx === 5 ? 'text-blue-600' : idx === 6 ? 'text-red-600' : 'text-muted-foreground'
                                    }`}
                                >
                                    {day}
                                </div>
                            ))}

                            {/* Previous month days (grayed out) */}
                            {prevMonthDays.map((day, idx) => (
                                <div key={`prev-${idx}`} className="min-h-[80px] rounded border border-transparent bg-gray-50 sm:min-h-[120px]" />
                            ))}

                            {/* Current month days */}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                                const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayShifts = shiftsByDate[dateKey] || [];
                                const holiday = holidayMap[dateKey];
                                const date = new Date(currentYear, currentMonth, day);
                                const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                                const isSaturday = dayOfWeek === 6;
                                const isSunday = dayOfWeek === 0;
                                const isTodayCell =
                                    new Date().getFullYear() === currentYear &&
                                    new Date().getMonth() === currentMonth &&
                                    new Date().getDate() === day;

                                // 背景色の優先順位: 今日 > 祥日 > 土曜 > 日曜 > 平日
                                let bgClass = 'bg-white';
                                let borderClass = 'border-gray-200';

                                if (isTodayCell) {
                                    bgClass = 'bg-green-50';
                                    borderClass = 'border-green-500';
                                } else if (holiday) {
                                    bgClass = 'bg-red-50';
                                    borderClass = 'border-red-200';
                                } else if (isSaturday) {
                                    bgClass = 'bg-blue-50';
                                    borderClass = 'border-blue-200';
                                } else if (isSunday) {
                                    bgClass = 'bg-red-50';
                                    borderClass = 'border-red-200';
                                }

                                return (
                                    <div
                                        key={day}
                                        className={`relative min-h-[80px] rounded border p-1 sm:min-h-[120px] sm:p-2 ${borderClass} ${bgClass}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <span
                                                className={`text-xs font-medium sm:text-sm ${
                                                    isTodayCell
                                                        ? 'text-green-700'
                                                        : holiday
                                                          ? 'text-red-600'
                                                          : isSunday
                                                            ? 'text-red-600'
                                                            : isSaturday
                                                              ? 'text-blue-600'
                                                              : 'text-foreground'
                                                }`}
                                            >
                                                {day}
                                            </span>
                                        </div>
                                        {holiday && <div className="mt-0.5 text-[10px] leading-tight text-red-600 sm:mt-1 sm:text-xs">{holiday}</div>}
                                        <div className="mt-1 sm:mt-2">
                                            {dayShifts.length > 0 ? (
                                                <div className="flex flex-col gap-0.5 sm:gap-1">
                                                    {dayShifts.map((shift: any, idx: number) => {
                                                        const shiftType = shift.shift_type || '';
                                                        const isDay = shiftType === 'day';
                                                        const isNight = shiftType === 'night';
                                                        const isLeave = shiftType === 'leave';

                                                        const tooltipKey = `${dateKey}-${idx}`;
                                                        const isOpen = tooltipOpen[tooltipKey] || false;

                                                        return (
                                                            <div key={idx} className="w-full">
                                                                {isDay || isNight ? (
                                                                    <TooltipProvider delayDuration={0}>
                                                                        <Tooltip
                                                                            open={isOpen}
                                                                            onOpenChange={(open) =>
                                                                                setTooltipOpen({ ...tooltipOpen, [tooltipKey]: open })
                                                                            }
                                                                        >
                                                                            <TooltipTrigger asChild>
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className={`inline-flex w-full cursor-pointer items-center justify-center gap-0.5 overflow-hidden px-1 py-0.5 sm:justify-start sm:gap-1 sm:px-2 sm:py-1 ${
                                                                                        isDay
                                                                                            ? 'border-yellow-300 bg-yellow-100 text-yellow-800'
                                                                                            : 'border-violet-300 bg-violet-100 text-violet-800'
                                                                                    }`}
                                                                                    onClick={() =>
                                                                                        setTooltipOpen({ ...tooltipOpen, [tooltipKey]: !isOpen })
                                                                                    }
                                                                                >
                                                                                    {isDay ? (
                                                                                        <>
                                                                                            <Sun className="h-3 w-3 flex-shrink-0" />
                                                                                            <span className="hidden truncate text-xs sm:inline">
                                                                                                8:30-17:00
                                                                                            </span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Moon className="h-3 w-3 flex-shrink-0" />
                                                                                            <span className="hidden truncate text-xs sm:inline">
                                                                                                17:00-22:00
                                                                                            </span>
                                                                                        </>
                                                                                    )}
                                                                                </Badge>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="top" sideOffset={5}>
                                                                                <p>{isDay ? '8:30-17:00' : '17:00-22:00'}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                ) : (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`inline-flex w-full items-center justify-center gap-0.5 overflow-hidden px-1 py-0.5 text-xs sm:justify-start sm:gap-1 sm:px-2 sm:py-1 ${
                                                                            isLeave
                                                                                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                                                                : 'bg-gray-100 text-gray-800'
                                                                        }`}
                                                                    >
                                                                        {isLeave ? '休' : '出勤'}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : publishedDatesSet.has(dateKey) ? (
                                                <div className="flex items-center gap-0.5 sm:gap-1">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-emerald-300 bg-emerald-100 text-[10px] text-emerald-800 sm:text-xs"
                                                    >
                                                        休
                                                    </Badge>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Next month days (grayed out) */}
                            {nextMonthDays.map((day, idx) => (
                                <div
                                    key={`next-${idx}`}
                                    className="min-h-[80px] rounded border border-transparent bg-gray-50 p-1 text-center text-gray-400 sm:min-h-[120px] sm:p-2"
                                ></div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
