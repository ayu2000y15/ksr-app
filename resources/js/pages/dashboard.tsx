import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { ja } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// パンくずリストの定義
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'ダッシュボード',
        href: route('dashboard'),
    },
];

// 時間メモリを描画するコンポーネント
function TimeScale({ offsetMinutes, totalWidth }: { offsetMinutes: number; totalWidth: number }) {
    const startHour = Math.floor(offsetMinutes / 60);
    const endHour = Math.ceil((offsetMinutes + totalWidth) / 60);
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    return (
        <div className="relative h-8 w-full border-b border-gray-200 bg-gray-50 text-gray-500">
            {hours.map((hour) => {
                const leftPosition = hour * 60 - offsetMinutes;
                const displayHour = hour % 24;
                const isMajorHour = displayHour % 6 === 0;

                return (
                    <div
                        key={hour}
                        className="absolute bottom-0 text-center"
                        style={{
                            left: `${leftPosition - 0.5}px`,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <span className="text-xs">{displayHour}</span>
                        <div className={`mx-auto mt-0.5 border-l border-gray-300 ${isMajorHour ? 'h-3' : 'h-1.5'}`} />
                    </div>
                );
            })}
        </div>
    );
}

// Right-side gantt bar only (used when left labels are rendered in a fixed column)
function GanttBar({
    shift,
    isAbsent,
    visualOffsetMinutes,
    currentDate,
}: {
    shift: any;
    isAbsent?: boolean;
    visualOffsetMinutes: number;
    currentDate: Date;
}) {
    const parse = (s: string | null) => (s ? new Date(s) : null);
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const minutesFromStart = (d: Date) => (d.getTime() - dayStart.getTime()) / 60000;

    const s = parse(shift.start_time) || (shift.date ? parse(shift.date + ' 00:00:00') : null) || dayStart;
    const e = parse(shift.end_time) || new Date(s.getTime() + 60 * 60 * 1000);
    const startM = minutesFromStart(s);
    const endM = minutesFromStart(e);
    const left = startM - visualOffsetMinutes;
    const width = Math.max(8, endM - startM);
    const st = String(shift.shift_type ?? shift.type ?? '');
    const isNight = st === 'night';
    const absent = Boolean(
        isAbsent ||
            String(shift.status ?? '') === 'absent' ||
            (Array.isArray(shift.breaks) && shift.breaks.some((bb: any) => String(bb.status ?? '') === 'absent')),
    );
    const barClass = absent ? 'bg-gray-300/60 text-gray-700' : isNight ? 'bg-indigo-700/80 text-white' : 'bg-yellow-400/80 text-black';

    const [activeBreak, setActiveBreak] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
    const hideTimer = useRef<number | null>(null);
    const touchTimer = useRef<number | null>(null);
    const activeBreakElRef = useRef<HTMLElement | null>(null);
    const tooltipElRef = useRef<HTMLElement | null>(null);
    const touchPersistent = useRef(false);
    const outsideHandlerRef = useRef<((ev: Event) => void) | null>(null);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => {
        try {
            const hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator && (navigator as any).maxTouchPoints > 0));
            setIsTouchDevice(Boolean(hasTouch));
        } catch {
            setIsTouchDevice(false);
        }
        return () => {
            if (hideTimer.current) window.clearTimeout(hideTimer.current);
            if (touchTimer.current) window.clearTimeout(touchTimer.current);
            if (outsideHandlerRef.current) {
                document.removeEventListener('touchstart', outsideHandlerRef.current);
                document.removeEventListener('mousedown', outsideHandlerRef.current);
                outsideHandlerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="relative h-10">
            <div
                className={`absolute top-2 z-10 flex h-6 items-center justify-start rounded pr-1 pl-2 text-xs ${barClass}`}
                style={{ left: `${left}px`, width: `${width}px` }}
            >
                <span className="truncate text-left">{`${s.getHours()}:${String(s.getMinutes()).padStart(2, '0')} - ${e.getHours()}:${String(e.getMinutes()).padStart(2, '0')}`}</span>
                {(shift.breaks || []).map((b: any, idx: number) => {
                    const bs = parse(b.start_time);
                    const be = parse(b.end_time);
                    if (!bs || !be) return null;
                    const bStartM = minutesFromStart(bs);
                    const bEndM = minutesFromStart(be);
                    const bLeft = bStartM - visualOffsetMinutes;
                    const bWidth = Math.max(4, bEndM - bStartM);
                    const relLeft = bLeft - left;

                    const bStatus = String(b.status ?? '');
                    let bgColor = 'rgba(34, 197, 94, 0.55)';
                    if (bStatus === 'absent') bgColor = 'rgba(107,114,128,0.25)';
                    else if (bStatus === 'scheduled') bgColor = 'rgba(156, 163, 175, 0.8)';

                    return (
                        <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            data-break="true"
                            onMouseEnter={(e) => {
                                if (hideTimer.current) {
                                    window.clearTimeout(hideTimer.current);
                                    hideTimer.current = null;
                                }
                                setActiveBreak(idx);
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                activeBreakElRef.current = e.currentTarget as HTMLElement;
                            }}
                            onMouseLeave={() => {
                                if (hideTimer.current) window.clearTimeout(hideTimer.current);
                                hideTimer.current = window.setTimeout(() => {
                                    setActiveBreak(null);
                                    setTooltipPos(null);
                                    hideTimer.current = null;
                                }, 300);
                            }}
                            onClick={(e) => {
                                // On touch devices, treat click as tap: toggle and install outside handler to close when tapping outside
                                if (isTouchDevice) {
                                    if (touchTimer.current) window.clearTimeout(touchTimer.current);
                                    setActiveBreak((cur) => (cur === idx ? null : idx));
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                    activeBreakElRef.current = e.currentTarget as HTMLElement;
                                    touchPersistent.current = true;

                                    const handleOutside = (ev: Event) => {
                                        const target = ev.target as Node;
                                        if (activeBreakElRef.current && activeBreakElRef.current.contains(target)) return;
                                        if (tooltipElRef.current && tooltipElRef.current.contains(target)) return;
                                        setActiveBreak(null);
                                        setTooltipPos(null);
                                        touchPersistent.current = false;
                                        if (outsideHandlerRef.current) {
                                            document.removeEventListener('touchstart', outsideHandlerRef.current);
                                            document.removeEventListener('mousedown', outsideHandlerRef.current);
                                            outsideHandlerRef.current = null;
                                        }
                                    };
                                    outsideHandlerRef.current = handleOutside;
                                    document.addEventListener('touchstart', handleOutside);
                                    document.addEventListener('mousedown', handleOutside);
                                } else {
                                    // desktop: keep click behavior (toggle) but don't install outside handler (hover handles hide)
                                    setActiveBreak((cur) => (cur === idx ? null : idx));
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                }
                            }}
                            className="absolute top-0 z-20 h-full rounded"
                            style={{ left: `${relLeft}px`, width: `${bWidth}px`, backgroundColor: bgColor, cursor: 'pointer' }}
                        />
                    );
                })}

                {activeBreak !== null && tooltipPos && shift.breaks && shift.breaks[activeBreak]
                    ? (() => {
                          const bb = shift.breaks[activeBreak];
                          const bs2 = parse(bb.start_time);
                          const be2 = parse(bb.end_time);
                          if (!bs2 || !be2) return null;
                          const statusLabel = String(bb.status ?? '');
                          const prefix =
                              statusLabel === 'scheduled' ? '予定' : statusLabel === 'actual' ? '実績' : statusLabel === 'absent' ? '欠勤' : '実績';
                          const timeLabel2 = `${prefix}：${String(bs2.getHours()).padStart(2, '0')}:${String(bs2.getMinutes()).padStart(2, '0')}～${String(be2.getHours()).padStart(2, '0')}:${String(be2.getMinutes()).padStart(2, '0')}`;
                          const el = (
                              <div
                                  style={{
                                      position: 'fixed',
                                      left: tooltipPos.x,
                                      top: Math.max(8, tooltipPos.y - 34),
                                      transform: 'translateX(-50%)',
                                      zIndex: 2147483647,
                                  }}
                              >
                                  <div
                                      ref={(r) => {
                                          tooltipElRef.current = r as HTMLDivElement | null;
                                      }}
                                      data-tooltip="true"
                                      onMouseEnter={() => {
                                          if (hideTimer.current) {
                                              window.clearTimeout(hideTimer.current);
                                              hideTimer.current = null;
                                          }
                                      }}
                                      onMouseLeave={() => {
                                          if (hideTimer.current) window.clearTimeout(hideTimer.current);
                                          hideTimer.current = window.setTimeout(() => {
                                              setActiveBreak(null);
                                              setTooltipPos(null);
                                              hideTimer.current = null;
                                          }, 300);
                                      }}
                                      className="w-auto min-w-20 rounded bg-gray-800 px-2 py-1 text-center text-xs whitespace-nowrap text-white shadow"
                                  >
                                      {timeLabel2}
                                  </div>
                              </div>
                          );
                          try {
                              return createPortal(el, document.body);
                          } catch {
                              return el;
                          }
                      })()
                    : null}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<any[]>([]);
    const [ganttWidth, setGanttWidth] = useState(900);
    const [ganttOffset, setGanttOffset] = useState(300);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const page = usePage<SharedData>();
    const { auth } = page.props as any;
    const permissions: string[] = page.props?.auth?.permissions ?? [];
    const isSuperAdmin: boolean = page.props?.auth?.isSuperAdmin ?? (page.props as any)['auth.isSuperAdmin'] ?? false;
    const nestedPermissions = (page.props as unknown as { permissions?: Record<string, any> } | undefined)?.permissions;

    // determine if user may view/manage shifts using same logic as app-sidebar
    let canViewShifts = false;
    if (isSuperAdmin) canViewShifts = true;
    else {
        const perm = 'shift.view';
        const hasFlat = permissions.includes(perm);
        let hasNested = false;
        const parts = perm.split('.');
        if (parts.length === 2 && nestedPermissions && nestedPermissions[parts[0]]) {
            const key = parts[1];
            hasNested = Boolean(nestedPermissions[parts[0]][key]);
        }
        if (hasFlat || hasNested) canViewShifts = true;
    }
    const leftRowsRef = useRef<HTMLDivElement | null>(null);
    const rightRowsRef = useRef<HTMLDivElement | null>(null);
    // separate refs for desktop/mobile instances so we can pick the visible one
    const leftDesktopRef = useRef<HTMLDivElement | null>(null);
    const rightDesktopRef = useRef<HTMLDivElement | null>(null);
    const leftMobileRef = useRef<HTMLDivElement | null>(null);
    const rightMobileRef = useRef<HTMLDivElement | null>(null);
    const [rowsHeight, setRowsHeight] = useState<number>(360);

    useEffect(() => {
        const compute = () => {
            try {
                // pick a visible element among possible desktop/mobile containers
                const candidates = [rightDesktopRef.current, rightMobileRef.current, leftDesktopRef.current, leftMobileRef.current];
                const topEl =
                    candidates.find((el) => !!el && (el.getClientRects().length > 0 || (el as HTMLElement).offsetParent != null)) ||
                    rightRowsRef.current ||
                    leftRowsRef.current;
                const top = topEl ? topEl.getBoundingClientRect().top : 0;
                const reserved = 220; // header, paddings, controls
                const avail = Math.max(160, window.innerHeight - top - reserved);
                setRowsHeight(avail);
            } catch {
                setRowsHeight(360);
            }
        };

        compute();
        window.addEventListener('resize', compute);
        let ro: ResizeObserver | null = null;
        try {
            ro = new ResizeObserver(compute);
            ro.observe(document.body);
        } catch {
            /* ignore ResizeObserver not supported */
        }
        return () => {
            window.removeEventListener('resize', compute);
            if (ro) ro.disconnect();
        };
    }, []);

    // sync vertical scroll between left and right columns
    useEffect(() => {
        // determine visible left/right containers (desktop or mobile)
        const pickVisible = () => {
            const leftCandidates = [leftDesktopRef.current, leftRowsRef.current, leftMobileRef.current];
            const rightCandidates = [rightDesktopRef.current, rightRowsRef.current, rightMobileRef.current];
            const leftEl = leftCandidates.find((el) => !!el && (el.getClientRects().length > 0 || (el as HTMLElement).offsetParent != null)) || null;
            const rightEl =
                rightCandidates.find((el) => !!el && (el.getClientRects().length > 0 || (el as HTMLElement).offsetParent != null)) || null;
            return { leftEl, rightEl };
        };

        const { leftEl: left, rightEl: right } = pickVisible();
        if (!left || !right) return;
        // prevent re-entrant updates causing jitter: use a small lock + rAF
        const syncing = { value: false } as { value: boolean };

        const onRight = () => {
            if (syncing.value) return;
            const target = right.scrollTop;
            if (left.scrollTop === target) return;
            syncing.value = true;
            // align in next frame to avoid intermediate events
            requestAnimationFrame(() => {
                left.scrollTop = target;
                // release lock in next frame
                requestAnimationFrame(() => {
                    syncing.value = false;
                });
            });
        };

        const onLeft = () => {
            if (syncing.value) return;
            const target = left.scrollTop;
            if (right.scrollTop === target) return;
            syncing.value = true;
            requestAnimationFrame(() => {
                right.scrollTop = target;
                requestAnimationFrame(() => {
                    syncing.value = false;
                });
            });
        };

        right.addEventListener('scroll', onRight, { passive: true });
        left.addEventListener('scroll', onLeft, { passive: true });

        // if viewport changes (responsive), re-run effect to rebind listeners
        return () => {
            try {
                right.removeEventListener('scroll', onRight);
                left.removeEventListener('scroll', onLeft);
            } catch {}
        };
    }, [rowsHeight, shifts]);

    useEffect(() => {
        (async () => {
            try {
                const pad = (n: number) => String(n).padStart(2, '0');
                const key = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(currentDate.getDate())}`;
                const res = await axios.get(route('shift-details.api'), { params: { date: key } });
                const payload = res.data || {};
                const raw = payload.shiftDetails ?? payload;
                let arr: any[] = [];
                if (Array.isArray(raw)) arr = raw;
                else if (raw && typeof raw === 'object') arr = Object.values(raw);
                else arr = [];

                const breaks = arr.filter((r: any) => String(r.type ?? '') === 'break');
                const works = arr.filter((r: any) => {
                    const t = String(r.type ?? '');
                    if (t === 'work') return true;
                    if (t === 'break') return false;
                    return Boolean(r.shift_type || r.start_time || r.end_time);
                });

                const dateKey = new Date(currentDate);
                dateKey.setHours(0, 0, 0, 0);

                const annotatedWorks = works
                    .map((w: any) => {
                        const attached = breaks.filter((b: any) => {
                            try {
                                if (b.shift_detail_id && Number(b.shift_detail_id) === Number(w.id)) return true;
                                if (b.user_id && Number(b.user_id) === Number(w.user_id)) return true;
                                return false;
                            } catch {
                                return false;
                            }
                        });
                        return { ...w, breaks: attached };
                    })
                    .filter((w: any) => {
                        try {
                            const start = w.start_time ? new Date(w.start_time) : w.date ? new Date(w.date + ' 00:00:00') : null;
                            if (!start) return false;
                            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                            return d.getTime() >= dateKey.getTime();
                        } catch {
                            return false;
                        }
                    });

                // sort: day shifts first, then by user id ascending
                annotatedWorks.sort((a: any, b: any) => {
                    const aIsNight = String(a.shift_type ?? a.type ?? '') === 'night';
                    const bIsNight = String(b.shift_type ?? b.type ?? '') === 'night';
                    if (aIsNight !== bIsNight) return aIsNight ? 1 : -1; // day (not night) first
                    const aId = Number(a.user?.id ?? a.user_id ?? 0);
                    const bId = Number(b.user?.id ?? b.user_id ?? 0);
                    return aId - bId;
                });

                if (annotatedWorks.length > 0) {
                    const dayStart = new Date(currentDate);
                    dayStart.setHours(0, 0, 0, 0);
                    const minutesFromStart = (d: Date) => (d.getTime() - dayStart.getTime()) / 60000;
                    const parse = (s: string | null) => (s ? new Date(s) : null);

                    let minStartMinute = Infinity;
                    let maxEndMinute = 0;

                    annotatedWorks.forEach((shift) => {
                        const s = parse(shift.start_time) || (shift.date ? parse(shift.date + ' 00:00:00') : null) || dayStart;
                        const e = parse(shift.end_time) || new Date(s.getTime() + 60 * 60 * 1000);
                        const startM = minutesFromStart(s);
                        const endM = minutesFromStart(e);

                        if (startM < minStartMinute) minStartMinute = startM;
                        if (endM > maxEndMinute) maxEndMinute = endM;
                    });

                    const PADDING_MINUTES = 60;
                    const newOffset = minStartMinute - PADDING_MINUTES;
                    const newTotalWidth = maxEndMinute + PADDING_MINUTES - newOffset;

                    setGanttOffset(newOffset);
                    setGanttWidth(Math.max(900, newTotalWidth));
                } else {
                    setGanttOffset(300);
                    setGanttWidth(900);
                }

                setShifts(annotatedWorks);
            } catch {
                setShifts([]);
            }
        })();
    }, [currentDate]);

    const goToPreviousDay = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
    };

    const goToNextDay = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 1);
        setCurrentDate(newDate);
    };

    //【追加】今日に戻るための関数
    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            setCurrentDate(date);
        }
        setIsCalendarOpen(false);
    };

    //【修正】今日の日付かどうかを判定し、表示を切り替える
    let formattedDate;
    const today = new Date();
    if (
        currentDate.getFullYear() === today.getFullYear() &&
        currentDate.getMonth() === today.getMonth() &&
        currentDate.getDate() === today.getDate()
    ) {
        const dayOfWeek = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(currentDate);
        formattedDate = `本日 (${dayOfWeek})`;
    } else {
        formattedDate = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).format(currentDate);
    }

    // 昼/夜の出勤人数を計算（欠勤はカウントしない）
    let dayCount = 0;
    let nightCount = 0;
    shifts.forEach((s) => {
        try {
            const st = String(s.shift_type ?? s.type ?? '');
            const isNight = st === 'night';
            const absent =
                String(s.status ?? '') === 'absent' ||
                (Array.isArray(s.breaks) && s.breaks.some((b: { status?: string | undefined }) => String(b.status ?? '') === 'absent'));
            if (!absent) {
                if (isNight) nightCount += 1;
                else dayCount += 1;
            }
        } catch {
            /* ignore malformed entries */
        }
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ダッシュボード" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>お知らせ</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>現在、新しいお知らせはありません。</p>
                            <div className="mt-2 text-xs text-muted-foreground" />
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader className="flex flex-wrap items-center justify-between md:flex-row">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-ms sm:text-xl">{formattedDate}</CardTitle>
                                {canViewShifts && (
                                    <Button
                                        onClick={() => {
                                            const d = new Date();
                                            const pad = (n: number) => String(n).padStart(2, '0');
                                            const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                                            // navigate to daily timeline for today
                                            try {
                                                router.get(
                                                    route('shifts.daily'),
                                                    { date: iso },
                                                    { preserveState: true, only: ['shiftDetails', 'queryParams'] },
                                                );
                                            } catch {
                                                // fallback: direct link navigation
                                                window.location.href = route('shifts.daily', { date: iso });
                                            }
                                        }}
                                    >
                                        今日のシフト
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="icon">
                                            <CalendarIcon className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={currentDate} onSelect={handleDateSelect} initialFocus locale={ja} />
                                    </PopoverContent>
                                </Popover>
                                {/*【追加】本日ボタンを配置*/}
                                <Button variant="outline" onClick={goToToday}>
                                    本日
                                </Button>
                                <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={goToNextDay}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {shifts.length === 0 ? (
                                <div className="text-sm text-muted-foreground">この日のシフトはありません</div>
                            ) : (
                                <div>
                                    {/* Desktop View */}
                                    <div>
                                        <div className="flex">
                                            {/* left fixed column outside horizontal scroller */}
                                            <div className="w-20 flex-shrink-0 text-xs md:w-40">
                                                <div className="flex h-8 items-center gap-2 border-b border-gray-200 px-2 text-xs">
                                                    <Badge variant="default" className="border-transparent bg-yellow-100 text-yellow-800">
                                                        昼 {`(${dayCount})`}
                                                    </Badge>
                                                    <Badge variant="outline" className="border-transparent bg-indigo-100 text-indigo-800">
                                                        夜 {`(${nightCount})`}
                                                    </Badge>
                                                </div>
                                                <div
                                                    ref={(el) => {
                                                        leftRowsRef.current = el;
                                                        leftDesktopRef.current = el;
                                                    }}
                                                    style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', overflowX: 'hidden' }}
                                                >
                                                    <div className="flex flex-col">
                                                        {shifts.map((s) => {
                                                            const absent =
                                                                String(s.status ?? '') === 'absent' ||
                                                                (Array.isArray(s.breaks) &&
                                                                    s.breaks.some(
                                                                        (b: { status?: string | undefined }) => String(b.status ?? '') === 'absent',
                                                                    ));
                                                            const isCurrentUser =
                                                                auth.user && Number(s.user?.id ?? s.user_id) === Number(auth.user.id);
                                                            return (
                                                                <div
                                                                    key={s.id}
                                                                    className={`flex h-10 items-center truncate border-b px-2 text-xs font-medium md:text-sm ${isCurrentUser ? 'bg-blue-50' : 'bg-white'}`}
                                                                >
                                                                    <span
                                                                        className={`mr-2 inline-block w-12 text-right font-mono ${absent ? 'text-gray-500 line-through' : ''}`}
                                                                    >
                                                                        {String(s.user?.id ?? s.user_id)}
                                                                    </span>
                                                                    <span className={absent ? 'truncate text-gray-500 line-through' : 'truncate'}>
                                                                        {s.user?.name ?? '—'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* right area: horizontal scroller containing time scale and gantt */}
                                            <div className="flex-1 overflow-x-auto" style={{ overflowY: 'hidden' }}>
                                                <div style={{ minWidth: `${ganttWidth}px` }}>
                                                    <div className="sticky top-0 z-20 bg-white">
                                                        <TimeScale offsetMinutes={ganttOffset} totalWidth={ganttWidth} />
                                                    </div>

                                                    <div
                                                        ref={(el) => {
                                                            rightRowsRef.current = el;
                                                            rightDesktopRef.current = el;
                                                        }}
                                                        style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', overflowX: 'hidden' }}
                                                    >
                                                        <div style={{ minWidth: `${ganttWidth}px` }}>
                                                            <div className="flex flex-col">
                                                                {shifts.map((s) => {
                                                                    const absent =
                                                                        String(s.status ?? '') === 'absent' ||
                                                                        (Array.isArray(s.breaks) &&
                                                                            s.breaks.some(
                                                                                (b: { status?: string | undefined }) =>
                                                                                    String(b.status ?? '') === 'absent',
                                                                            ));
                                                                    const isCurrentUser =
                                                                        auth.user && Number(s.user?.id ?? s.user_id) === Number(auth.user.id);
                                                                    return (
                                                                        <div
                                                                            key={s.id}
                                                                            className={`flex h-10 items-center border-b ${isCurrentUser ? 'bg-blue-50' : 'bg-white'}`}
                                                                        >
                                                                            <div className="flex h-10 items-center">
                                                                                <GanttBar
                                                                                    shift={s}
                                                                                    isAbsent={absent}
                                                                                    visualOffsetMinutes={ganttOffset}
                                                                                    currentDate={currentDate}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
