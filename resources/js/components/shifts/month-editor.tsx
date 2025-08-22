import { Button } from '@/components/ui/button';
import Toast from '@/components/ui/toast';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Cell = '' | 'day' | 'night' | 'leave';

export default function MonthEditor({
    users,
    days,
    holidays = [],
    existingShifts = {},
    onMonthChange,
    accentClass,
}: {
    users: Array<{ id: number; name: string }>;
    days: string[];
    holidays?: string[];
    existingShifts?: Record<number, Record<string, Cell>>;
    onMonthChange?: (monthIso: string) => void;
    accentClass?: string;
}) {
    // parse YYYY-MM-DD into a local Date (avoid new Date('YYYY-MM-DD') which is parsed as UTC in many engines)
    const parseLocal = (iso?: string) => {
        if (!iso) return new Date();
        const parts = iso.split('-').map((p) => parseInt(p, 10));
        if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return new Date(iso);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    // small pad helper used for building month query
    const pad = (n: number) => String(n).padStart(2, '0');

    // month state so arrows can navigate months (initialized from `days` prop)
    const [currentYear, setCurrentYear] = useState(() => {
        if (days && days.length) return parseLocal(days[0]).getFullYear();
        return new Date().getFullYear();
    });
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (days && days.length) return parseLocal(days[0]).getMonth();
        return new Date().getMonth();
    });

    // keep internal month state in sync when parent-provided `days` changes
    useEffect(() => {
        if (days && days.length) {
            const d = parseLocal(days[0]);
            setCurrentYear(d.getFullYear());
            setCurrentMonth(d.getMonth());
        }
    }, [days]);

    // compute days for the currently displayed month
    const visibleDays = useMemo(() => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const year = currentYear;
        const month = currentMonth; // 0-11
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const out: string[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(year, month, d);
            out.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
        }
        return out;
    }, [currentYear, currentMonth]);

    // state grid: userId -> date -> value
    const buildInitialGrid = useCallback(
        (dayList: string[]) => {
            const initial: Record<number, Record<string, Cell>> = {};
            users.forEach((u) => {
                initial[u.id] = {};
                dayList.forEach((d) => {
                    // prefer existing DB value (handle numeric or string keys), otherwise empty (未設定)
                    let val: Cell = '';
                    if (existingShifts) {
                        const byNum = (existingShifts as any)[u.id];
                        const byStr = (existingShifts as any)[String(u.id)];
                        const source = byNum ?? byStr ?? null;
                        if (source && source[d] !== undefined) {
                            // cast defensively to Cell
                            val = source[d] as Cell;
                        }
                    }
                    initial[u.id][d] = val;
                });
            });
            return initial;
        },
        [users, existingShifts],
    );

    const [grid, setGrid] = useState<Record<number, Record<string, Cell>>>(() => ({}));
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set());

    // debounce map to coalesce rapid changes
    const pendingSavesRef = useRef<Record<string, NodeJS.Timeout>>({});

    // build grid when visibleDays, users or existingShifts change
    useEffect(() => {
        setGrid(buildInitialGrid(visibleDays));
    }, [visibleDays, users, existingShifts, buildInitialGrid]);

    const setCell = (userId: number, date: string, val: Cell) => {
        setGrid((prev) => ({ ...prev, [userId]: { ...prev[userId], [date]: val } }));
    };

    const containerRef = useRef<HTMLDivElement | null>(null);

    const scrollBy = (delta: number) => {
        if (containerRef.current) containerRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    };

    const handlePrev = () => {
        let ty = currentYear;
        let tm = currentMonth - 1;
        if (tm < 0) {
            ty -= 1;
            tm = 11;
        }
        const monthParam = `${ty}-${pad(tm + 1)}-01`;
        if (onMonthChange) return onMonthChange(monthParam);
        router.get(route('shifts.index', { month: monthParam }), {}, { preserveState: true, preserveScroll: true });
    };

    const handleNext = () => {
        let ty = currentYear;
        let tm = currentMonth + 1;
        if (tm > 11) {
            ty += 1;
            tm = 0;
        }
        const monthParam = `${ty}-${pad(tm + 1)}-01`;
        if (onMonthChange) return onMonthChange(monthParam);
        router.get(route('shifts.index', { month: monthParam }), {}, { preserveState: true, preserveScroll: true });
    };

    const saveEntry = async (userId: number, date: string, shift_type: Cell) => {
        setSaving(true);
        try {
            // treat empty string as null -> server will delete existing shift
            const payloadType = shift_type === '' ? null : shift_type;
            const res = await axios.post(route('shifts.bulk_update'), { entries: [{ user_id: userId, date, shift_type: payloadType }] });
            const msg = res?.data?.message ?? '保存しました';
            setToast({ message: msg, type: 'success' });
        } catch (err: unknown) {
            // try to extract a meaningful message safely
            let msg = '保存に失敗しました';
            try {
                const j = err as { response?: { data?: { message?: string } } };
                if (j?.response?.data?.message) msg = j.response.data.message;
            } catch {
                // ignore extraction errors
            }
            setToast({ message: msg, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const queueSave = (userId: number, date: string, shift_type: Cell) => {
        const key = `${userId}:${date}`;
        if (pendingSavesRef.current[key]) clearTimeout(pendingSavesRef.current[key]);
        // debounce 300ms
        pendingSavesRef.current[key] = setTimeout(() => {
            delete pendingSavesRef.current[key];
            saveEntry(userId, date, shift_type);
        }, 300) as unknown as NodeJS.Timeout;
    };

    const weekdayShort = (iso: string) => {
        const dt = parseLocal(iso);
        return ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()];
    };

    const toggleDateSelection = (date: string) => {
        setSelectedDates((prev) => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    };

    const bulkSetSelectedToDay = () => {
        if (selectedDates.size === 0) return;
        users.forEach((u) => {
            selectedDates.forEach((d) => {
                setCell(u.id, d, 'day');
                queueSave(u.id, d, 'day');
            });
        });
        setToast({ message: '選択日を昼にしました', type: 'success' });
        setSelectedDates(new Set());
    };

    return (
        <div className="rounded border bg-white">
            <div className="p-2">
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handlePrev} aria-label="前の月">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-sm font-medium">
                            {currentYear}年{currentMonth + 1}月
                        </div>
                        <Button size="sm" onClick={handleNext} aria-label="次の月">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={bulkSetSelectedToDay} disabled={selectedDates.size === 0} aria-label="選択日を昼に">
                            選択日を昼に
                        </Button>
                        {saving && <div className="text-sm text-muted-foreground">保存中…</div>}
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute top-0 left-0 flex h-full items-center">
                        <Button size="sm" onClick={() => scrollBy(-400)} aria-label="左にスクロール">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="overflow-x-auto" ref={containerRef} style={{ margin: '0 48px' }}>
                        <table className="min-w-full table-fixed text-sm">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 z-30 w-48 bg-white p-2 align-top whitespace-nowrap"></th>
                                    {visibleDays.map((d) => {
                                        const dt = parseLocal(d);
                                        const isSat = dt.getDay() === 6;
                                        const isSun = dt.getDay() === 0;
                                        const isHoliday = (holidays || []).includes(d);
                                        const textClass = isHoliday || isSun ? 'text-red-600' : isSat ? 'text-blue-600' : '';
                                        const tDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const isToday = tDate.getTime() === today.getTime();

                                        return (
                                            <th key={d} className={`w-12 p-1 text-center ${isToday ? 'bg-green-100' : (accentClass ?? '')}`}>
                                                <div className="mb-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDates.has(d)}
                                                        onChange={() => toggleDateSelection(d)}
                                                        aria-label={`日付 ${d} を選択`}
                                                    />
                                                </div>
                                                <div className={`text-xs ${textClass}`}>{`${dt.getMonth() + 1}/${dt.getDate()}`}</div>
                                                <div className={`text-[10px] ${textClass}`}>{weekdayShort(d)}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td
                                            className="sticky left-0 z-20 truncate bg-white p-1 align-top whitespace-nowrap"
                                            style={{ maxWidth: '12rem' }}
                                        >
                                            {u.name}
                                        </td>
                                        {visibleDays.map((d) => {
                                            const cellVal = grid[u.id]?.[d] ?? '';
                                            const bgClass =
                                                cellVal === 'day'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : cellVal === 'night'
                                                      ? 'bg-blue-100 text-blue-800'
                                                      : cellVal === 'leave'
                                                        ? 'bg-red-100 text-red-800'
                                                        : '';
                                            return (
                                                <td key={d} className="p-1 text-center">
                                                    <select
                                                        value={cellVal}
                                                        onChange={(e) => {
                                                            const val = e.target.value as Cell;
                                                            setCell(u.id, d, val);
                                                            queueSave(u.id, d, val);
                                                        }}
                                                        className={`rounded border p-1 text-xs ${bgClass}`}
                                                    >
                                                        <option value=""> </option>
                                                        <option value="day">昼</option>
                                                        <option value="night">夜</option>
                                                        <option value="leave">休</option>
                                                    </select>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="sticky left-0 z-20 w-48 bg-white p-1 align-top whitespace-nowrap">出勤数</td>
                                    {visibleDays.map((d) => {
                                        const dayCount = Object.keys(grid).reduce((acc, uid) => {
                                            const v = (grid as any)[Number(uid)]?.[d] ?? '';
                                            return acc + (v === 'day' ? 1 : 0);
                                        }, 0);
                                        const nightCount = Object.keys(grid).reduce((acc, uid) => {
                                            const v = (grid as any)[Number(uid)]?.[d] ?? '';
                                            return acc + (v === 'night' ? 1 : 0);
                                        }, 0);
                                        return (
                                            <td key={d} className="p-1 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="text-[11px]">
                                                        <span className="inline-block rounded bg-yellow-100 px-2 py-0.5 text-black">
                                                            昼 {dayCount}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px]">
                                                        <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-black">
                                                            夜 {nightCount}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div className="absolute top-0 right-0 flex h-full items-center">
                        <Button size="sm" onClick={() => scrollBy(400)} aria-label="右にスクロール">
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </div>
    );
}
