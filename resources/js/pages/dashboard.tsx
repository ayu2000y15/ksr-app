import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// パンくずリストの定義
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'ダッシュボード',
        href: route('dashboard'),
    },
];

//【修正】時間メモリを描画するコンポーネント
function TimeScale({ offsetMinutes, totalWidth }: { offsetMinutes: number; totalWidth: number }) {
    // 表示すべき時間の開始と終了を動的に計算
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
                            left: `${leftPosition}px`,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GanttBar({ shift, isAbsent, visualOffsetMinutes }: { shift: any; isAbsent?: boolean; visualOffsetMinutes: number }) {
    const parse = (s: string | null) => (s ? new Date(s) : null);
    const dayStart = new Date();
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

    useEffect(() => {
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
                                setActiveBreak((cur) => (cur === idx ? null : idx));
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                            }}
                            onTouchStart={(e) => {
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
    const [shifts, setShifts] = useState<any[]>([]);
    const [ganttWidth, setGanttWidth] = useState(900);
    //【修正】オフセット値を固定値からState管理に変更
    const [ganttOffset, setGanttOffset] = useState(300); // デフォルトは5時(300分)

    useEffect(() => {
        (async () => {
            try {
                const today = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                const key = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
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

                const todayKey = new Date();
                todayKey.setHours(0, 0, 0, 0);

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
                            return d.getTime() >= todayKey.getTime();
                        } catch {
                            return false;
                        }
                    });

                //【修正】ここから表示範囲の動的計算ロジック
                if (annotatedWorks.length > 0) {
                    const dayStart = new Date();
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

                    const PADDING_MINUTES = 60; // 前後に1時間ずつの余白

                    // 新しいオフセットと幅を計算
                    const newOffset = minStartMinute - PADDING_MINUTES;
                    const newTotalWidth = maxEndMinute + PADDING_MINUTES - newOffset;

                    setGanttOffset(newOffset);
                    setGanttWidth(Math.max(900, newTotalWidth)); // 最低でも900pxの幅を確保
                } else {
                    // シフトがない場合はデフォルト値に戻す
                    setGanttOffset(300);
                    setGanttWidth(900);
                }

                setShifts(annotatedWorks);
            } catch {
                setShifts([]);
            }
        })();
    }, []);

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
                        <CardHeader>
                            <CardTitle>本日のシフト</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {shifts.length === 0 ? (
                                <div className="text-sm text-muted-foreground">本日のシフトはありません</div>
                            ) : (
                                <div>
                                    {/* Desktop View: sm(640px)以上の画面幅で表示 */}
                                    <div className="hidden sm:flex">
                                        <div className="w-40 flex-shrink-0">
                                            <div className="h-8 border-b border-gray-200"></div>
                                            <div className="flex flex-col gap-3">
                                                {shifts.map((s) => {
                                                    const absent =
                                                        String(s.status ?? '') === 'absent' ||
                                                        (Array.isArray(s.breaks) && s.breaks.some((b: any) => String(b.status ?? '') === 'absent'));
                                                    return (
                                                        <div key={s.id} className="flex h-10 items-center text-sm font-medium">
                                                            <span className={`mr-2 font-mono ${absent ? 'text-gray-500 line-through' : ''}`}>
                                                                {String(s.user?.id ?? s.user_id)}
                                                            </span>
                                                            <span className={absent ? 'text-gray-500 line-through' : ''}>{s.user?.name ?? '—'}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-x-auto">
                                            <div style={{ minWidth: `${ganttWidth}px` }}>
                                                <TimeScale offsetMinutes={ganttOffset} totalWidth={ganttWidth} />
                                                <div className="flex flex-col gap-3">
                                                    {shifts.map((s) => {
                                                        const absent =
                                                            String(s.status ?? '') === 'absent' ||
                                                            (Array.isArray(s.breaks) &&
                                                                s.breaks.some((b: any) => String(b.status ?? '') === 'absent'));
                                                        return (
                                                            <div key={s.id} className="bg-gray-50">
                                                                <GanttBar shift={s} isAbsent={absent} visualOffsetMinutes={ganttOffset} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile View: sm(640px)未満の画面幅で表示 */}
                                    <div className="flex sm:hidden">
                                        <div className="pr-2">
                                            <div className="h-8 border-b border-transparent"></div>
                                            <div className="flex flex-col gap-3">
                                                {shifts.map((s) => {
                                                    const absent =
                                                        String(s.status ?? '') === 'absent' ||
                                                        (Array.isArray(s.breaks) && s.breaks.some((b: any) => String(b.status ?? '') === 'absent'));
                                                    return (
                                                        <div key={s.id} className="flex h-10 items-center text-sm font-medium">
                                                            <span className={`mr-2 font-mono ${absent ? 'text-gray-500 line-through' : ''}`}>
                                                                {String(s.user?.id ?? s.user_id)}
                                                            </span>
                                                            <span className={absent ? 'text-gray-500 line-through' : ''}>{s.user?.name ?? '—'}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-x-auto">
                                            <div style={{ minWidth: `${ganttWidth}px` }}>
                                                <TimeScale offsetMinutes={ganttOffset} totalWidth={ganttWidth} />
                                                <div className="flex flex-col gap-3">
                                                    {shifts.map((s) => {
                                                        const absent =
                                                            String(s.status ?? '') === 'absent' ||
                                                            (Array.isArray(s.breaks) &&
                                                                s.breaks.some((b: any) => String(b.status ?? '') === 'absent'));
                                                        return (
                                                            <div key={s.id} className="bg-gray-50">
                                                                <GanttBar shift={s} isAbsent={absent} visualOffsetMinutes={ganttOffset} />
                                                            </div>
                                                        );
                                                    })}
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
