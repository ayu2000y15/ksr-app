import { Button } from '@/components/ui/button';
import Toast from '@/components/ui/toast';
import { Link, router } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Cell = '' | 'day' | 'night' | 'leave';

export default function MonthEditor({
    users,
    days,
    holidays = [],
    existingShifts = {},
    shiftDetails = [],
    // optional map provided by server: userId -> 出勤日数
    attendanceCounts,
    // optional array of default shift patterns from server
    defaultShifts,
    onMonthChange,
    accentClass,
}: {
    users: Array<{ id: number; name: string; position?: number; [k: string]: any }>;
    days: string[];
    holidays?: string[];
    existingShifts?: Record<number, Record<string, Cell>>;
    shiftDetails?: any[];
    attendanceCounts?: Record<number, number>;
    defaultShifts?: Array<any>;
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

    // client-side sorted users: prefer position then id (stable fallback by name)
    const sortedUsers = useMemo(() => {
        try {
            const list = Array.isArray(users) ? users.slice() : [];
            return list.sort((a: any, b: any) => {
                const ak = Number(a.position ?? a.id ?? 0);
                const bk = Number(b.position ?? b.id ?? 0);
                if (ak !== bk) return ak - bk;
                // fallback: keep deterministic order by id then name
                const aid = Number(a.id ?? 0);
                const bid = Number(b.id ?? 0);
                if (aid !== bid) return aid - bid;
                return String(a.name ?? '').localeCompare(String(b.name ?? ''));
            });
        } catch {
            return users || [];
        }
    }, [users]);

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
            const es = existingShifts as Record<string, Record<string, Cell>> | undefined;
            (sortedUsers || []).forEach((u: any) => {
                initial[u.id] = {};
                dayList.forEach((d) => {
                    // prefer existing DB value (handle numeric or string keys), otherwise empty (未設定)
                    let val: Cell = '';
                    const source = es?.[String(u.id)] ?? es?.[u.id];
                    if (source && source[d] !== undefined) {
                        val = source[d] as Cell;
                    }
                    initial[u.id][d] = val;
                });
            });
            return initial;
        },
        [sortedUsers, existingShifts],
    );

    const [grid, setGrid] = useState<Record<number, Record<string, Cell>>>(() => ({}));
    // keep a ref to grid so async callbacks can read latest values
    const gridRef = useRef(grid);
    useEffect(() => {
        gridRef.current = grid;
    }, [grid]);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set());
    const [selectedUsers, setSelectedUsers] = useState<Set<number>>(() => new Set());

    // attendance map shown in UI; initialized from prop if provided
    const [attendanceMap, setAttendanceMap] = useState<Record<number, number>>(() =>
        typeof attendanceCounts !== 'undefined' && attendanceCounts ? { ...attendanceCounts } : {},
    );

    // when prop changes, sync
    useEffect(() => {
        if (typeof attendanceCounts !== 'undefined' && attendanceCounts) {
            setAttendanceMap({ ...attendanceCounts });
        }
    }, [attendanceCounts]);

    // debounce map to coalesce rapid changes
    const pendingSavesRef = useRef<Record<string, NodeJS.Timeout>>({});

    // build grid when visibleDays, users or existingShifts change
    useEffect(() => {
        setGrid(buildInitialGrid(visibleDays));
    }, [visibleDays, users, existingShifts, buildInitialGrid]);

    const setCell = (userId: number, date: string, val: Cell) => {
        setGrid((prev) => ({ ...prev, [userId]: { ...prev[userId], [date]: val } }));
    };

    // helper to get attendance count for a user: prefer server-provided map, then user fields, otherwise count from existingShifts for visibleDays
    const getAttendanceCount = (u: { id: number; [k: string]: unknown }) => {
        if (attendanceMap && attendanceMap[u.id] !== undefined) return attendanceMap[u.id];
        if (u.attendance_count !== undefined) return u.attendance_count;
        if (u.work_days !== undefined) return u.work_days;

        const es = existingShifts as Record<string, Record<string, Cell>> | undefined;
        const source = es?.[String(u.id)] ?? es?.[u.id];
        if (!source) return 0;
        return visibleDays.reduce((acc, d) => acc + (source[d] === 'day' || source[d] === 'night' ? 1 : 0), 0);
    };

    const scrolledToTodayRef = useRef(false);
    // ref to store ongoing animation frames so we can cancel them
    const scrollAnimRef = useRef<Record<string, number | null>>({});

    // animate scrollLeft to target over duration (ms) with easeInOutQuad
    const animateScroll = (el: HTMLElement, target: number, duration = 360, key = 'default') => {
        if (!el) return;
        // cancel previous
        const prev = scrollAnimRef.current[key];
        if (prev) cancelAnimationFrame(prev);
        const start = el.scrollLeft;
        const delta = target - start;
        if (delta === 0) return;
        const startTime = performance.now();

        const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t); // easeInOut

        const step = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / duration);
            const eased = ease(t);
            el.scrollLeft = Math.round(start + delta * eased);
            if (t < 1) {
                scrollAnimRef.current[key] = requestAnimationFrame(step);
            } else {
                scrollAnimRef.current[key] = null;
                // ensure final position
                el.scrollLeft = target;
            }
        };

        scrollAnimRef.current[key] = requestAnimationFrame(step);
    };
    const handleScrollInteraction = (delta: number) => {
        console.debug('[MonthEditor] handleScrollInteraction', { delta });
        scrollBy(delta);
    };

    // scroll by a fraction of the visible viewport (direction: -1 left, 1 right)
    const scrollViewport = (direction: number) => {
        const cal = document.getElementById('calendar-scroll-container') as HTMLElement | null;
        if (!cal) {
            // fallback to fixed amount
            handleScrollInteraction(direction * 48 * 7);
            return;
        }
        // scroll by 90% of the visible width to behave like normal horizontal paging
        const delta = Math.round(cal.clientWidth * 0.9) * direction;
        handleScrollInteraction(delta);
    };

    const scrollBy = (delta: number) => {
        // デバッグ付き: メインカレンダーエリアの横スクロール（scrollTo を使い、範囲チェックを行う）
        const calendarScrollContainer = document.getElementById('calendar-scroll-container') as HTMLElement | null;
        console.debug('[MonthEditor] scrollBy called', { delta, calendarScrollContainerExists: !!calendarScrollContainer });
        if (calendarScrollContainer) {
            const scrollLeft = calendarScrollContainer.scrollLeft;
            const scrollWidth = calendarScrollContainer.scrollWidth;
            const clientWidth = calendarScrollContainer.clientWidth;
            const maxLeft = Math.max(0, scrollWidth - clientWidth);
            const target = Math.min(maxLeft, Math.max(0, scrollLeft + delta));
            const metrics = { scrollLeft, scrollWidth, clientWidth, maxLeft, target };
            console.debug('[MonthEditor] calendar metrics', metrics);
            try {
                animateScroll(calendarScrollContainer, target, 360, 'calendar');
            } catch (e) {
                // フォールバック
                console.debug('[MonthEditor] animateScroll failed, falling back to assignment', e);
                calendarScrollContainer.scrollLeft = target;
            }
            // ログのために少し遅延して最終位置を出す
            setTimeout(() => console.debug('[MonthEditor] calendar final scrollLeft', calendarScrollContainer.scrollLeft), 50);
        }

        // 統計フッターの横スクロールも連動
        const footerScrollContainer = document.getElementById('footer-scroll-container') as HTMLElement | null;
        console.debug('[MonthEditor] footer exists', { footerScrollContainerExists: !!footerScrollContainer });
        if (footerScrollContainer) {
            const scrollLeftF = footerScrollContainer.scrollLeft;
            const scrollWidthF = footerScrollContainer.scrollWidth;
            const clientWidthF = footerScrollContainer.clientWidth;
            const maxLeftF = Math.max(0, scrollWidthF - clientWidthF);
            const targetF = Math.min(maxLeftF, Math.max(0, scrollLeftF + delta));
            const metricsF = { scrollLeftF, scrollWidthF, clientWidthF, maxLeftF, targetF };
            console.debug('[MonthEditor] footer metrics', metricsF);
            try {
                animateScroll(footerScrollContainer, targetF, 360, 'footer');
            } catch (e) {
                console.debug('[MonthEditor] footer animateScroll failed, falling back', e);
                footerScrollContainer.scrollLeft = targetF;
            }
            setTimeout(() => console.debug('[MonthEditor] footer final scrollLeft', footerScrollContainer.scrollLeft), 50);
        }
    };

    // on first render (or when visibleDays changes), auto-scroll so today is visible in the viewport
    useEffect(() => {
        try {
            if (scrolledToTodayRef.current) return;

            // build today's yyyy-mm-dd key in local timezone
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            if (!visibleDays.includes(key)) return;

            const calendarScrollContainer = document.getElementById('calendar-scroll-container');
            if (!calendarScrollContainer) return;

            // find the header cell for today
            const th = calendarScrollContainer.querySelector(`div[data-date="${key}"]`) as HTMLElement | null;
            if (!th) return;

            // center the column in the visible area when possible
            const targetLeft = Math.max(0, th.offsetLeft - calendarScrollContainer.clientWidth / 2 + th.clientWidth / 2);
            calendarScrollContainer.scrollTo({ left: targetLeft, behavior: 'auto' });

            // 統計フッターも同期
            const footerScrollContainer = document.getElementById('footer-scroll-container');
            if (footerScrollContainer) {
                footerScrollContainer.scrollTo({ left: targetLeft, behavior: 'auto' });
            }

            scrolledToTodayRef.current = true;
        } catch {
            // noop on errors
        }
    }, [visibleDays]);

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
            // after successful save, recalc attendance count for this user from gridRef
            try {
                const g = gridRef.current[userId] ?? {};
                const cnt = visibleDays.reduce((acc, d) => {
                    const v = g[d] ?? '';
                    return acc + (v === 'day' || v === 'night' ? 1 : 0);
                }, 0);
                setAttendanceMap((prev) => ({ ...(prev ?? {}), [userId]: cnt }));
            } catch {
                // ignore
            }
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

    // determine whether a default shift pattern exists for the given date and shift_type
    const hasDefaultFor = (date: string, shiftType: 'day' | 'night') => {
        try {
            const dt = parseLocal(date);
            const dow = dt.getDay(); // 0-6
            const isHoliday = (holidays || []).includes(date);
            const patternType = isHoliday ? 'holiday' : 'weekday';
            const ds = defaultShifts || [];
            return ds.some((p: any) => {
                // be lenient about numeric/string types
                const pDow = Number(p.day_of_week);
                const pShift = p.shift_type;
                const pType = p.type;
                return pDow === dow && String(pShift) === shiftType && String(pType) === patternType;
            });
        } catch {
            return false;
        }
    };

    // determine whether there exists any 'work' ShiftDetail that overlaps the given date
    const hasWorkForDate = (date: string) => {
        try {
            if (!shiftDetails || !Array.isArray(shiftDetails)) return false;
            const dayStart = new Date(date + 'T00:00:00');
            const dayEnd = new Date(date + 'T23:59:59');
            const parseOrNull = (v: any) => {
                if (!v) return null;
                const s = String(v).replace(' ', 'T');
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            };
            return (shiftDetails || []).some((sd: any) => {
                try {
                    if (sd.type !== 'work') return false;
                    const s = parseOrNull(sd.start_time ?? sd.date);
                    const e = parseOrNull(sd.end_time ?? sd.start_time ?? sd.date);
                    if (!s || !e) return false;
                    return s <= dayEnd && e >= dayStart;
                } catch {
                    return false;
                }
            });
        } catch {
            return false;
        }
    };

    const toggleDateSelection = (date: string) => {
        try {
            const dt = parseLocal(date);
            const dayStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dayStart < today.getTime()) return; // ignore past dates
        } catch {
            // if parse fails, proceed with toggle
        }

        setSelectedDates((prev) => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    };

    const toggleUserSelection = (userId: number) => {
        setSelectedUsers((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const toggleAllUsers = () => {
        if (selectedUsers.size === sortedUsers.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(sortedUsers.map((u: any) => u.id)));
        }
    };

    const toggleAllDates = () => {
        // only toggle future dates
        const futureDates = visibleDays.filter((d) => {
            try {
                const dt = parseLocal(d);
                const dayStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return dayStart >= today.getTime();
            } catch {
                return true;
            }
        });

        if (selectedDates.size === futureDates.length) {
            setSelectedDates(new Set());
        } else {
            setSelectedDates(new Set(futureDates));
        }
    };

    const bulkSetSelectedToDay = () => {
        if (selectedDates.size === 0 || selectedUsers.size === 0) {
            setToast({ message: 'ユーザーと日付の両方を選択してください', type: 'info' });
            return;
        }

        selectedUsers.forEach((userId) => {
            selectedDates.forEach((d) => {
                // only set to 'day' if the cell is currently empty (do not overwrite existing assignments)
                const cur = gridRef.current?.[userId]?.[d] ?? '';
                if (cur === '') {
                    setCell(userId, d, 'day');
                    queueSave(userId, d, 'day');
                }
            });
        });

        setToast({ message: `${selectedUsers.size}人のユーザーの${selectedDates.size}日分を昼にしました`, type: 'success' });
        setSelectedDates(new Set());
        setSelectedUsers(new Set());
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
                        <Button size="sm" variant="outline" onClick={toggleAllDates} aria-label="全日選択/解除" title="未来の全日付を選択/解除">
                            {selectedDates.size > 0 ? '全日解除' : '全日選択'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={toggleAllUsers} aria-label="全ユーザー選択/解除" title="全ユーザーを選択/解除">
                            {selectedUsers.size === sortedUsers.length && sortedUsers.length > 0 ? '全ユーザー解除' : '全ユーザー選択'}
                        </Button>
                        <Button
                            size="sm"
                            aria-label="規定休日登録"
                            onClick={async () => {
                                try {
                                    // confirm action
                                    const ok = window.confirm(
                                        'この操作は当該月の全ユーザーの希望週休を一括登録します。\nすでに登録済みのシフトがある場合は、上書きされる可能性があります。\nよろしいですか？',
                                    );
                                    if (!ok) return;
                                    setSaving(true);
                                    const monthParam = `${currentYear}-${pad(currentMonth + 1)}-01`;
                                    const res = await axios.post(route('shifts.apply_preferred_holidays'), { month: monthParam });
                                    const msg = res?.data?.message ?? '処理が完了しました。';
                                    setToast({ message: msg, type: 'success' });
                                    // refresh current month view
                                    if (onMonthChange) {
                                        onMonthChange(monthParam);
                                    } else {
                                        router.get(route('shifts.index', { month: monthParam }), {}, { preserveState: true, preserveScroll: true });
                                    }
                                } catch (err: unknown) {
                                    let msg = '規定休日の登録に失敗しました';
                                    try {
                                        const j = err as { response?: { data?: { message?: string } } };
                                        if (j?.response?.data?.message) msg = j.response.data.message;
                                    } catch {
                                        void 0;
                                    }
                                    setToast({ message: msg, type: 'error' });
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving}
                        >
                            規定休日登録
                        </Button>
                        <Button
                            size="sm"
                            onClick={bulkSetSelectedToDay}
                            disabled={selectedDates.size === 0 || selectedUsers.size === 0}
                            aria-label="選択日を昼に"
                        >
                            選択日を昼に ({selectedUsers.size}人 × {selectedDates.size}日)
                        </Button>
                        {saving && <div className="text-sm text-muted-foreground">保存中…</div>}
                    </div>
                </div>

                {/* ユーザー向けヒント: 月切替ボタンの下に表示（背景 + アイコン） */}
                <div className="mb-4">
                    <div className="flex items-start gap-3 rounded border-l-4 border-yellow-200 bg-yellow-50 p-3 text-sm text-muted-foreground">
                        <Info className="h-5 w-5 flex-shrink-0 text-yellow-700" />
                        <div className="leading-tight">
                            <div>
                                ・<strong> 「確定」ボタン</strong>:
                                過去日にのみ表示されます。確定ボタンを押せば勤務時間と休憩時間が確定され、統計情報が正しく計算されます。
                            </div>
                            <div className="mt-1">
                                ・<strong> 「選択日を昼に」ボタン</strong>:
                                ユーザーと日付のチェックボックスで選択した組み合わせを昼に設定します。すでに登録済みの予定は変更されません。
                            </div>
                            <div className="mt-1">
                                ・<strong> 「規定休日登録」ボタン</strong>:
                                ユーザーによって固定希望休日がある場合に、その月の休日をまとめて登録します。
                            </div>
                            <div className="mt-1">
                                ・<strong>日別の詳細シフト</strong>:
                                日付を選択すると、その日の詳細シフトを編集できます。休憩登録や欠席の登録は日別の詳細から行ってください。
                            </div>
                            <div className="mt-1">・規定のシフト時間があるユーザーは自動で時間が変更されます。</div>
                        </div>
                    </div>
                </div>

                <div className="relative" style={{ height: 'calc(100vh - 200px)' }}>
                    {/* debug badge removed */}
                    <div
                        className="absolute top-0 left-0 z-40 flex h-full items-center"
                        onClick={() => scrollViewport(-1)}
                        onPointerDown={() => scrollViewport(-1)}
                    >
                        <Button size="sm" aria-label="左にスクロール（1週間）">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </div>
                    <div
                        className="absolute top-0 right-0 z-40 flex h-full items-center"
                        onClick={() => scrollViewport(1)}
                        onPointerDown={() => scrollViewport(1)}
                    >
                        <Button size="sm" aria-label="右にスクロール（1週間）">
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* カレンダーコンテナ */}
                    <div className="flex h-full overflow-hidden" style={{ margin: '0 48px' }}>
                        {/* 左側: 固定ユーザー名列 */}
                        <div className="flex w-24 flex-shrink-0 flex-col border-r bg-white md:w-48">
                            {/* ヘッダー部分 */}
                            <div className="sticky top-0 z-30 flex h-20 items-end border-b bg-white p-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.size === sortedUsers.length && sortedUsers.length > 0}
                                        onChange={toggleAllUsers}
                                        aria-label="すべてのユーザーを選択"
                                        title="すべてのユーザーを選択/解除"
                                    />
                                    <span className="text-sm font-medium">{`ユーザー名 (出勤日数)`}</span>
                                </div>
                            </div>

                            {/* ユーザー名一覧 */}
                            <div
                                className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
                                style={{
                                    height: 'calc(100% - 160px)',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                }}
                                id="user-scroll-container"
                                onScroll={(e) => {
                                    // 右側カレンダーエリアの縦スクロールと連動
                                    const calendarScrollContainer = document.getElementById('calendar-scroll-container');
                                    if (calendarScrollContainer) {
                                        calendarScrollContainer.scrollTop = e.currentTarget.scrollTop;
                                    }
                                }}
                            >
                                {users.map((u) => (
                                    <div key={`user-${u.id}`} className="flex h-12 items-center border-b bg-white p-2" style={{ maxWidth: '12rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.has(u.id)}
                                            onChange={() => toggleUserSelection(u.id)}
                                            aria-label={`ユーザー ${u.name} を選択`}
                                            className="mr-2 flex-shrink-0"
                                        />
                                        <span className="truncate text-sm">
                                            <span className="mr-2 inline-block w-8 text-right font-mono text-sm">{u.position}</span>
                                            <Link
                                                href={route('users.show', { user: u.id })}
                                                className="truncate text-sm text-blue-600 hover:underline"
                                                title={`ユーザー詳細: ${u.name}`}
                                            >
                                                {u.name}
                                            </Link>
                                            <span className="ml-2 text-xs text-muted-foreground">({String(getAttendanceCount(u))})</span>
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* 左側統計フッター */}
                            <div className="flex h-20 flex-shrink-0 items-center border-t bg-gray-50 p-2">
                                <span className="text-sm font-medium">出勤数</span>
                            </div>
                        </div>

                        {/* 右側: スクロール可能なカレンダーエリア */}
                        <div className="flex flex-1 flex-col overflow-hidden">
                            <div
                                className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden"
                                style={{
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent',
                                }}
                                id="calendar-scroll-container"
                                onScroll={(e) => {
                                    // 左側ユーザー名列の縦スクロールと連動
                                    const userScrollContainer = document.getElementById('user-scroll-container');
                                    if (userScrollContainer) {
                                        userScrollContainer.scrollTop = e.currentTarget.scrollTop;
                                    }

                                    // 統計フッターの横スクロールと連動
                                    const footerScrollContainer = document.getElementById('footer-scroll-container');
                                    if (footerScrollContainer) {
                                        footerScrollContainer.scrollLeft = e.currentTarget.scrollLeft;
                                    }
                                }}
                            >
                                <div className="min-w-full" style={{ minWidth: `${visibleDays.length * 48}px` }}>
                                    {/* ヘッダー行 */}
                                    <div className="sticky top-0 z-20 h-20 border-b bg-white">
                                        <div className="flex">
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
                                                    <div
                                                        key={d}
                                                        data-date={d}
                                                        className={`w-12 flex-shrink-0 border-r p-1 text-center ${isToday ? 'bg-green-100' : (accentClass ?? '')}`}
                                                    >
                                                        <div className="mb-1">
                                                            {(() => {
                                                                try {
                                                                    const dayStart = new Date(
                                                                        dt.getFullYear(),
                                                                        dt.getMonth(),
                                                                        dt.getDate(),
                                                                    ).getTime();
                                                                    const todayStart = new Date();
                                                                    todayStart.setHours(0, 0, 0, 0);
                                                                    const isPastCheckbox = dayStart < todayStart.getTime();
                                                                    if (isPastCheckbox) {
                                                                        // for past dates, show the confirm/unconfirm button only when there is at least one work record for the date
                                                                        if (hasWorkForDate(d)) {
                                                                            return (
                                                                                <ConfirmToggleButton
                                                                                    date={d}
                                                                                    shiftDetails={shiftDetails}
                                                                                    onToast={(m: string, t?: any) =>
                                                                                        setToast({ message: m, type: t })
                                                                                    }
                                                                                />
                                                                            );
                                                                        }
                                                                        return <div aria-hidden="true" style={{ height: '16px' }} />;
                                                                    }
                                                                } catch {
                                                                    // fall back to showing checkbox if parse fails
                                                                }
                                                                return (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedDates.has(d)}
                                                                        onChange={() => toggleDateSelection(d)}
                                                                        aria-label={`日付 ${d} を選択`}
                                                                    />
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Link
                                                                href={route('shifts.daily', { date: d })}
                                                                className={`inline-block cursor-pointer rounded px-1 py-0.5 select-none ${textClass} hover:bg-gray-100`}
                                                                title={`この日のタイムラインを見る: ${d}`}
                                                            >
                                                                <div className="text-xs">{`${dt.getMonth() + 1}/${dt.getDate()}`}</div>
                                                                <div className="text-[10px]">({weekdayShort(d)})</div>
                                                            </Link>
                                                            {/* button shown above (in the mb-1 area) for past dates */}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* データ行 */}
                                    <div style={{ minHeight: 'calc(100vh - 520px)' }}>
                                        {users.map((u) => (
                                            <div key={`row-${u.id}`} className="flex h-12 border-b">
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
                                                    // determine if this date is strictly before today (local) -> disable select
                                                    const dt = parseLocal(d);
                                                    const dayStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    const isPast = dayStart < today.getTime();
                                                    return (
                                                        <div
                                                            key={d}
                                                            className="flex w-12 flex-shrink-0 items-center justify-center border-r p-1 text-center"
                                                        >
                                                            <select
                                                                value={cellVal}
                                                                onChange={(e) => {
                                                                    const val = e.target.value as Cell;
                                                                    setCell(u.id, d, val);
                                                                    queueSave(u.id, d, val);
                                                                }}
                                                                className={`w-full rounded border py-1 text-xs ${bgClass} ${isPast ? 'cursor-not-allowed opacity-60' : ''}`}
                                                                disabled={isPast}
                                                                title={
                                                                    isPast
                                                                        ? '過去日は変更できません。\n時間を変更する場合は日間タイムラインから変更してください。'
                                                                        : ''
                                                                }
                                                            >
                                                                <option value=""> </option>
                                                                {/* show 'day' only if a default shift exists for this date, or if it's currently selected */}
                                                                {(hasDefaultFor(d, 'day') || cellVal === 'day') && <option value="day">昼</option>}
                                                                {(hasDefaultFor(d, 'night') || cellVal === 'night') && (
                                                                    <option value="night">夜</option>
                                                                )}
                                                                <option value="leave">休</option>
                                                            </select>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 右側統計フッター */}
                            <div
                                className="h-20 flex-shrink-0 overflow-x-auto border-t bg-gray-50 [&::-webkit-scrollbar]:hidden"
                                style={{
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                }}
                                id="footer-scroll-container"
                                onScroll={(e) => {
                                    // カレンダーエリアの横スクロールと連動
                                    const calendarScrollContainer = document.getElementById('calendar-scroll-container');
                                    if (calendarScrollContainer) {
                                        calendarScrollContainer.scrollLeft = e.currentTarget.scrollLeft;
                                    }
                                }}
                            >
                                <div className="flex" style={{ minWidth: `${visibleDays.length * 48}px` }}>
                                    {visibleDays.map((d) => {
                                        const dayCount = Object.keys(grid).reduce((acc, uid) => {
                                            const numericUid = Number(uid);
                                            const v = grid[numericUid]?.[d] ?? '';
                                            return acc + (v === 'day' ? 1 : 0);
                                        }, 0);
                                        const nightCount = Object.keys(grid).reduce((acc, uid) => {
                                            const numericUid = Number(uid);
                                            const v = grid[numericUid]?.[d] ?? '';
                                            return acc + (v === 'night' ? 1 : 0);
                                        }, 0);
                                        return (
                                            <div
                                                key={d}
                                                className="flex h-full w-12 flex-shrink-0 items-center justify-center border-r p-1 text-center"
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="text-[11px]">
                                                        <span className="inline-block rounded bg-yellow-100 px-1 py-0.5 text-black">
                                                            昼 {dayCount}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px]">
                                                        <span className="inline-block rounded bg-blue-100 px-1 py-0.5 text-black">
                                                            夜 {nightCount}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </div>
    );
}

function ConfirmToggleButton({
    date,
    shiftDetails,
    onToast,
}: {
    date: string;
    shiftDetails?: any[];
    onToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
    const [loading, setLoading] = useState(false);
    const [confirmed, setConfirmed] = useState<boolean | null>(null);

    // derive initial confirmed state from provided shiftDetails:
    // - if any work-type detail for the date has status 'scheduled', prefer showing the "確定" action (i.e. not confirmed)
    // - otherwise, if any work-type detail has status 'actual', treat as confirmed
    useEffect(() => {
        try {
            if (!shiftDetails) return;
            const dayStart = new Date(date + 'T00:00:00');
            const dayEnd = new Date(date + 'T23:59:59');
            const parseOrNull = (v: any) => {
                if (!v) return null;
                const s = String(v).replace(' ', 'T');
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            };

            let hasScheduled = false;
            let hasActual = false;
            (shiftDetails || []).some((sd: any) => {
                try {
                    if (sd.type !== 'work') return false;
                    const s = parseOrNull(sd.start_time ?? sd.date);
                    const e = parseOrNull(sd.end_time ?? sd.start_time ?? sd.date);
                    if (!s || !e) return false;
                    const overlaps = s <= dayEnd && e >= dayStart;
                    if (!overlaps) return false;
                    if (sd.status === 'scheduled') {
                        hasScheduled = true;
                        return true; // stop early, scheduled takes priority
                    }
                    if (sd.status === 'actual') {
                        hasActual = true;
                    }
                    return false;
                } catch {
                    return false;
                }
            });

            if (hasScheduled) {
                setConfirmed(false);
            } else if (hasActual) {
                setConfirmed(true);
            } else {
                setConfirmed(null);
            }
        } catch {
            // ignore
        }
    }, [date, shiftDetails]);

    const toggle = async () => {
        setLoading(true);
        try {
            const res = await axios.post(route('shifts.toggle_confirm_date'), { date });
            const j = res.data || {};
            setConfirmed(j.confirmed === true);
            if (onToast) onToast(j.message || (j.confirmed ? '確定しました。' : '解除しました。'), 'success');
        } catch (e) {
            if (onToast) onToast('操作に失敗しました。', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            className={`rounded border px-1 py-1 text-xs ${confirmed ? 'bg-green-100 text-green-800' : 'bg-white text-gray-700'}`}
            onClick={(e) => {
                e.preventDefault();
                toggle();
            }}
            disabled={loading}
            title="当日の勤務確定/解除"
        >
            {loading ? '...' : confirmed ? '解除' : '確定'}
        </button>
    );
}
