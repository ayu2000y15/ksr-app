import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import axios from 'axios';
import { ChevronLeft, ChevronRight, LoaderCircle, Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type DayCounts = { day: number; night: number };
type HolidayItem = { date: string; name: string };

type Props = {
    open: boolean;
    onClose: () => void;
    /** 表示を開始する月（去年の該当月）。'YYYY-MM-DD' 形式 */
    initialMonthIso: string;
};

const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

const pad = (n: number) => String(n).padStart(2, '0');

export default function ReferenceCalendar({ open, onClose, initialMonthIso }: Props) {
    const initial = useMemo(() => {
        const parts = (initialMonthIso || '').split('-').map((p) => parseInt(p, 10));
        if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
            return { year: parts[0], month: parts[1] - 1 };
        }
        const now = new Date();
        return { year: now.getFullYear() - 1, month: now.getMonth() };
    }, [initialMonthIso]);

    const [currentYear, setCurrentYear] = useState(initial.year);
    const [currentMonth, setCurrentMonth] = useState(initial.month);
    const [counts, setCounts] = useState<Record<string, DayCounts>>({});
    const [holidays, setHolidays] = useState<HolidayItem[]>([]);
    const [loading, setLoading] = useState(false);

    // ダイアログを開くたびに初期月へ戻す
    useEffect(() => {
        if (open) {
            setCurrentYear(initial.year);
            setCurrentMonth(initial.month);
        }
    }, [open, initial.year, initial.month]);

    // 月が変わるたびにサーバーから集計を取得
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const monthParam = `${currentYear}-${pad(currentMonth + 1)}-01`;
        setLoading(true);
        axios
            .get('/shifts/attendance-counts', { params: { month: monthParam } })
            .then((res) => {
                if (cancelled) return;
                setCounts((res.data && res.data.counts) || {});
                setHolidays((res.data && res.data.holidays) || []);
            })
            .catch(() => {
                if (cancelled) return;
                setCounts({});
                setHolidays([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, currentYear, currentMonth]);

    const { daysInMonth, firstDayOfWeek, prevMonthDays, nextMonthDays } = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const dayOfWeek = firstDay.getDay();
        const firstDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 月曜始まり
        const prevMonthDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);
        const totalCells = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;
        const nextMonthDays = Array.from({ length: totalCells - daysInMonth - firstDayOfWeek }, (_, i) => i);
        return { daysInMonth, firstDayOfWeek, prevMonthDays, nextMonthDays };
    }, [currentYear, currentMonth]);

    const holidayMap = useMemo(() => {
        const map: Record<string, string> = {};
        holidays.forEach((h) => {
            map[h.date] = h.name;
        });
        return map;
    }, [holidays]);

    const handlePrevMonth = () => {
        let y = currentYear;
        let m = currentMonth - 1;
        if (m < 0) {
            y -= 1;
            m = 11;
        }
        setCurrentYear(y);
        setCurrentMonth(m);
    };

    const handleNextMonth = () => {
        let y = currentYear;
        let m = currentMonth + 1;
        if (m > 11) {
            y += 1;
            m = 0;
        }
        setCurrentYear(y);
        setCurrentMonth(m);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>昨年参考（出勤人数）</DialogTitle>
                </DialogHeader>

                <div className="mb-3 flex items-center justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[120px] text-center text-base font-medium sm:text-lg">
                        {currentYear}年{currentMonth + 1}月
                    </div>
                    <Button size="sm" variant="outline" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    {loading && <LoaderCircle className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {/* 凡例 */}
                <div className="mb-3 rounded-md border bg-blue-50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:text-sm">
                        <div className="flex items-center gap-1">
                            <Sun className="h-3 w-3 text-yellow-600 sm:h-4 sm:w-4" />
                            <span>昼 出勤人数</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Moon className="h-3 w-3 text-violet-600 sm:h-4 sm:w-4" />
                            <span>夜 出勤人数</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
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

                    {/* 前月の空セル */}
                    {prevMonthDays.map((_, idx) => (
                        <div key={`prev-${idx}`} className="min-h-[72px] rounded border border-transparent bg-gray-50 sm:min-h-[96px]" />
                    ))}

                    {/* 当月 */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const dateKey = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;
                        const c = counts[dateKey] || { day: 0, night: 0 };
                        const holiday = holidayMap[dateKey];
                        const date = new Date(currentYear, currentMonth, day);
                        const dayOfWeek = date.getDay();
                        const isSaturday = dayOfWeek === 6;
                        const isSunday = dayOfWeek === 0;

                        let bgClass = 'bg-white';
                        let borderClass = 'border-gray-200';
                        if (holiday) {
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
                            <div key={day} className={`relative min-h-[72px] rounded border p-1 sm:min-h-[96px] sm:p-2 ${borderClass} ${bgClass}`}>
                                <div className="flex items-start justify-between">
                                    <span
                                        className={`text-xs font-medium sm:text-sm ${
                                            holiday ? 'text-red-600' : isSunday ? 'text-red-600' : isSaturday ? 'text-blue-600' : 'text-foreground'
                                        }`}
                                    >
                                        {day}
                                    </span>
                                </div>
                                {holiday && <div className="mt-0.5 text-[10px] leading-tight text-red-600 sm:text-xs">{holiday}</div>}
                                <div className="mt-1 flex flex-col gap-0.5 sm:gap-1">
                                    <div className="inline-flex items-center justify-between rounded border border-yellow-300 bg-yellow-100 px-1 py-0.5 text-xs text-yellow-800 sm:px-2">
                                        <span className="flex items-center gap-0.5">
                                            <Sun className="h-3 w-3 flex-shrink-0" />
                                            <span className="hidden sm:inline">昼</span>
                                        </span>
                                        <span className="font-semibold tabular-nums">{c.day}</span>
                                    </div>
                                    <div className="inline-flex items-center justify-between rounded border border-violet-300 bg-violet-100 px-1 py-0.5 text-xs text-violet-800 sm:px-2">
                                        <span className="flex items-center gap-0.5">
                                            <Moon className="h-3 w-3 flex-shrink-0" />
                                            <span className="hidden sm:inline">夜</span>
                                        </span>
                                        <span className="font-semibold tabular-nums">{c.night}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* 翌月の空セル */}
                    {nextMonthDays.map((_, idx) => (
                        <div key={`next-${idx}`} className="min-h-[72px] rounded border border-transparent bg-gray-50 sm:min-h-[96px]" />
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
