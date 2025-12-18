import TransportRequestModal from '@/components/transport-request-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Toast from '@/components/ui/toast';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { ja } from 'date-fns/locale';
import { CalendarIcon, Car, ChevronLeft, ChevronRight, Edit, Plus, Trash } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Minimal local types to reduce `any` usage in this file.
type Assignee = { id?: number; name?: string };
type BreakItem = { start_time?: string | undefined; end_time?: string | undefined; status?: string | undefined; type?: string | undefined };
type Shift = {
    id?: number;
    start_time?: string | null;
    end_time?: string | null;
    date?: string | null;
    shift_type?: string | null;
    type?: string | null;
    status?: string | null;
    breaks?: BreakItem[];
    user?: any;
    [key: string]: any;
};
type Task = {
    id?: number;
    title?: string;
    status?: string | null;
    category?: { name?: string; color?: string } | string | null;
    category_color?: string | null;
    assignees?: any[];
    description?: string | null;
    start?: string | null;
    end?: string | null;
    [key: string]: any;
};

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
    shift: Shift;
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
                    const isOuting = String(b.type ?? '') === 'outing';
                    let bgColor = '';
                    if (bStatus === 'absent') {
                        bgColor = 'rgba(107,114,128,0.25)';
                    } else if (isOuting) {
                        // outings: scheduled = lighter orange, actual = darker orange
                        bgColor = bStatus === 'actual' ? 'rgba(234,88,12,0.65)' : 'rgb(216, 27, 96,0.4)';
                    } else {
                        // normal breaks: actual = green, scheduled = gray
                        bgColor = bStatus === 'actual' ? 'rgba(34, 197, 94, 0.55)' : 'rgba(156, 163, 175, 0.8)';
                    }

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
                          const isOuting2 = String(bb.type ?? '') === 'outing';
                          const prefix = isOuting2
                              ? statusLabel === 'scheduled'
                                  ? '外出'
                                  : statusLabel === 'actual'
                                    ? '外出（実績）'
                                    : '外出'
                              : statusLabel === 'scheduled'
                                ? '休憩（予定）'
                                : statusLabel === 'actual'
                                  ? '休憩（実績）'
                                  : statusLabel === 'absent'
                                    ? '欠勤'
                                    : '休憩（実績）';
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
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [hasTransportRequestForDate, setHasTransportRequestForDate] = useState(false);
    const [ganttWidth, setGanttWidth] = useState(900);
    const [ganttOffset, setGanttOffset] = useState(300);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isShiftCalendarOpen, setIsShiftCalendarOpen] = useState(false);
    const page = usePage<SharedData>();
    // Use a typed view of shared page props to avoid sprinkling `any` casts.
    const { auth } = page.props as any;
    // compatibility: support nested `auth.isSuperAdmin` or top-level shared 'auth.isSuperAdmin'
    const isSuperAdmin: boolean = Boolean((auth && (auth.isSuperAdmin ?? page.props['auth.isSuperAdmin'])) ?? false);
    // permissions: keep as any for compatibility with various shapes from server
    const permissions: any = (auth && auth.permissions) ?? page.props['auth.permissions'] ?? [];
    const nestedPermissions: any = (auth && auth.permissions) ?? page.props['auth.permissions'] ?? null;
    const shiftConfig = (page.props && (page.props as any).shift) ?? { application_deadline_days: 0 };
    const deadlineDays = Number(shiftConfig.application_deadline_days) || 0;
    const maxSelectableDate: Date | null =
        deadlineDays > 0
            ? (() => {
                  const d = new Date();
                  d.setHours(0, 0, 0, 0);
                  d.setDate(d.getDate() + deadlineDays);
                  return d;
              })()
            : null;
    const canCreateAnnouncements = (() => {
        try {
            if (isSuperAdmin) return true;
            const perms = page.props?.auth?.permissions;
            if (Array.isArray(perms)) return perms.includes('announcement.create');
            if (perms && typeof perms === 'object') {
                if (perms['announcement.create']) return true;
                if (perms.announcement && (perms.announcement.create === true || perms.announcement.create === 1)) return true;
            }
        } catch {}
        return false;
    })();

    // determine if user may view/manage shifts using same logic as app-sidebar
    let canViewShifts = false;
    if (isSuperAdmin) canViewShifts = true;
    else {
        // Check for shift.view or shift.daily.view permission
        const perms = ['shift.view', 'shift.daily.view'];
        for (const perm of perms) {
            const hasFlat = permissions.includes(perm);
            let hasNested = false;
            const parts = perm.split('.');
            if (parts.length === 2 && nestedPermissions && nestedPermissions[parts[0]]) {
                const key = parts[1];
                hasNested = Boolean(nestedPermissions[parts[0]][key]);
            }
            if (hasFlat || hasNested) {
                canViewShifts = true;
                break;
            }
        }
    }
    // determine if user may view tasks (calendar)
    let canViewTasks = false;
    if (isSuperAdmin) canViewTasks = true;
    else {
        const perm = 'task.view';
        const hasFlat = Array.isArray(permissions) && permissions.includes(perm);
        const hasNested = Boolean(nestedPermissions && nestedPermissions.tasks && nestedPermissions.tasks.view);
        if (hasFlat || hasNested) canViewTasks = true;
    }
    const leftRowsRef = useRef<HTMLDivElement | null>(null);
    const rightRowsRef = useRef<HTMLDivElement | null>(null);
    // separate refs for desktop/mobile instances so we can pick the visible one
    const leftDesktopRef = useRef<HTMLDivElement | null>(null);
    const rightDesktopRef = useRef<HTMLDivElement | null>(null);
    const leftMobileRef = useRef<HTMLDivElement | null>(null);
    const rightMobileRef = useRef<HTMLDivElement | null>(null);
    const [rowsHeight, setRowsHeight] = useState<number>(360);
    // has_car flag fallback: if server didn't include has_car on auth.user, fetch active users and resolve
    const [hasCarFlag, setHasCarFlag] = useState<boolean | null>(() => {
        try {
            const v =
                auth && auth.user && typeof auth.user.has_car !== 'undefined' ? Boolean(auth.user.has_car === 1 || auth.user.has_car === true) : null;
            return v;
        } catch {
            return null;
        }
    });
    // toast shown on dashboard (used by child components; modal will call onSuccess after closing)
    type ToastState = { message: string; type: 'success' | 'error' } | null;
    const [toast, setToast] = useState<ToastState>(null);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [unreadPosts, setUnreadPosts] = useState<any[]>([]);
    // 今日の予定（タスク）を表示するための state
    const [todayTasks, setTodayTasks] = useState<Task[]>([]);
    const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<number | null>(null);
    const [editingAnnouncement, setEditingAnnouncement] = useState<any | null>(null);
    const [annPage, setAnnPage] = useState(1);
    const [perPage] = useState(5);
    const [totalAnnouncements, setTotalAnnouncements] = useState<number | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    // Published dates from server
    const publishedDates = ((page.props as any).publishedDates || []) as string[];
    const publishedDatesSet = new Set(publishedDates);

    useEffect(() => {
        if (hasCarFlag !== null) return; // already known
        (async () => {
            try {
                const res = await axios.get('/api/active-users');
                const list = (res.data && res.data.users) || res.data || [];
                if (Array.isArray(list) && auth && auth.user && auth.user.id != null) {
                    const me = list.find((u: unknown) => Number((u as any).id) === Number((auth as any).user.id));
                    if (me && typeof me.has_car !== 'undefined') {
                        setHasCarFlag(Boolean((me as any).has_car === 1 || (me as any).has_car === true));
                        return;
                    }
                }
            } catch {
                // ignore
            }
            setHasCarFlag(false);
        })();
    }, [hasCarFlag, auth]);

    // load announcements with pagination
    const loadAnnouncements = async (p: number, append = false) => {
        try {
            if (append) setLoadingMore(true);
            const res = await axios.get('/api/announcements', { params: { page: p, per_page: perPage } });
            const items = (res.data && res.data.announcements) || [];
            const total = typeof res.data?.total === 'number' ? res.data.total : null;
            if (append) setAnnouncements((cur) => cur.concat(items));
            else setAnnouncements(Array.isArray(items) ? items : []);
            if (total !== null) setTotalAnnouncements(total);
            setAnnPage(p);
        } catch {
            if (!append) setAnnouncements([]);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        loadAnnouncements(1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // load recent board posts and show unread ones (limit small number)
    useEffect(() => {
        let mounted = true;

        const isPostViewed = (p: any) => {
            try {
                return (
                    p.viewed_by_current_user === true ||
                    p.viewed_by_current_user === 1 ||
                    p.viewedByCurrentUser === true ||
                    p.viewByCurrentUser === true ||
                    p.viewed_by_current_user === '1'
                );
            } catch {
                return false;
            }
        };

        const fetchUnreadPosts = async () => {
            try {
                // add a cache-busting timestamp to avoid stale CDN/server caches in production
                // NOTE: include polls as well as board posts; server `type` param accepts a single value,
                // so omit it here and filter on the client to include both 'board' and 'poll' types.
                const res = await axios.get('/api/posts', { params: { per_page: 8, _t: Date.now() } });
                const items = (res.data && (res.data.data || res.data)) || [];
                const arr = Array.isArray(items) ? items : items.data || [];
                // only consider board and poll posts for unread list
                const visible = (arr as any[]).filter((p) => {
                    try {
                        const t = String(p.type ?? 'board');
                        return t === 'board' || t === 'poll' || t === 'manual';
                    } catch {
                        return true;
                    }
                });
                const unread = visible.filter((p) => !isPostViewed(p));
                if (!mounted) return;
                setUnreadPosts(unread.slice(0, 5));
            } catch {
                if (!mounted) return;
                setUnreadPosts([]);
            }
        };

        // initial fetch
        void fetchUnreadPosts();

        // poll periodically (fallback if other pages don't notify)
        const POLL_MS = 30_000; // 30s
        const pollId = window.setInterval(fetchUnreadPosts, POLL_MS);

        // when the tab becomes visible, refresh immediately
        const onVisibility = () => {
            if (document.visibilityState === 'visible') fetchUnreadPosts();
        };
        document.addEventListener('visibilitychange', onVisibility);

        // listen to a global event so other pages/components can notify that a post was read
        const onPostRead = (ev: Event) => {
            try {
                const custom = ev as CustomEvent;
                const id = custom?.detail;
                if (!id) return;
                setUnreadPosts((cur) => cur.filter((p) => Number(p.id) !== Number(id)));
            } catch {
                // ignore
            }
        };
        window.addEventListener('postRead', onPostRead as EventListener);

        return () => {
            mounted = false;
            window.clearInterval(pollId);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('postRead', onPostRead as EventListener);
        };
    }, []);

    // load tasks for the currently selected date on dashboard (only if user can view tasks)
    useEffect(() => {
        if (!canViewTasks) {
            setTodayTasks([]);
            return;
        }
        (async () => {
            try {
                const pad = (n: number) => String(n).padStart(2, '0');
                // use the selected currentDate (not system today) so switching dates reloads tasks
                const d = new Date(currentDate);
                const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                // request tasks that overlap the selected date; API accepts params.month in many pages, but we use date filter here
                const res = await axios.get('/api/tasks', { params: { date: iso, per_page: 50 } });
                const items = (res.data && (res.data.tasks || res.data)) || [];
                // normalize to expected shape
                const mapped = Array.isArray(items)
                    ? items.map((t: any) => ({
                          id: t.id,
                          title: t.title,
                          category: t.category || null,
                          assignees: t.assignees || t.user_ids || [],
                          status: t.status || null,
                          description: t.description || null,
                          start_at: t.start_at || null,
                          end_at: t.end_at || null,
                      }))
                    : [];

                // Build day boundaries based on the selected date
                const todayStart = new Date(d);
                todayStart.setHours(0, 0, 0, 0);
                const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

                const filtered = mapped.filter((t: any) => {
                    try {
                        const s = t.start_at ? new Date(String(t.start_at).replace(' ', 'T')) : null;
                        const e = t.end_at ? new Date(String(t.end_at).replace(' ', 'T')) : null;
                        if (s && e) {
                            // overlap: s <= todayEnd && e >= todayStart
                            return s.getTime() <= todayEnd.getTime() && e.getTime() >= todayStart.getTime();
                        }
                        if (s && !e) {
                            // include only if start date equals selected date
                            const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
                            return sd.getTime() === todayStart.getTime();
                        }
                        return false;
                    } catch {
                        return false;
                    }
                });

                setTodayTasks(filtered);
            } catch (e) {
                setTodayTasks([]);
            }
        })();
    }, [canViewTasks, currentDate]);

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

                // include both 'break' and 'outing' so outings will be displayed on gantt bars
                const breaks = arr.filter((r: any) => {
                    const t = String(r.type ?? '');
                    return t === 'break' || t === 'outing';
                });
                // only include explicit work shifts in the left user list
                const works = arr.filter((r: any) => String(r.type ?? '') === 'work');

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

                // sort: day shifts first, then by user position ascending
                annotatedWorks.sort((a: any, b: any) => {
                    const aIsNight = String(a.shift_type ?? a.type ?? '') === 'night';
                    const bIsNight = String(b.shift_type ?? b.type ?? '') === 'night';
                    if (aIsNight !== bIsNight) return aIsNight ? 1 : -1; // day (not night) first
                    const aPos = Number(a.user?.position ?? 0);
                    const bPos = Number(b.user?.position ?? 0);
                    return aPos - bPos;
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
                // check transport requests for this date (per current user)
                const both = await fetchTransportBothForDate(currentDate);
                setHasTransportRequestForDate(Boolean(both));
            } catch {
                setShifts([]);
                setHasTransportRequestForDate(false);
            }
        })();
    }, [currentDate, auth?.user?.id]);

    // helper: returns true if current logged-in user has BOTH to and from transport requests on date d
    const fetchTransportBothForDate = useCallback(
        async (d: Date) => {
            try {
                const pad = (n: number) => String(n).padStart(2, '0');
                const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const res2 = await axios.get('/api/transport-requests', { params: { date: key } });
                const trs = (res2.data && res2.data.transport_requests) || [];
                const userId = auth?.user?.id;
                if (!userId) return false;
                type TR = { created_by?: number | string; direction?: string };
                const my = Array.isArray(trs) ? (trs as TR[]).filter((t) => Number(t.created_by) === Number(userId)) : [];
                const hasTo = my.some((t) => String(t.direction) === 'to');
                const hasFrom = my.some((t) => String(t.direction) === 'from');
                return Boolean(hasTo && hasFrom);
            } catch {
                return false;
            }
        },
        [auth?.user?.id],
    );

    const goToPreviousDay = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
    };

    const goToNextDay = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 1);
        // respect application deadline
        try {
            if (maxSelectableDate) {
                const nd = new Date(newDate);
                nd.setHours(0, 0, 0, 0);
                if (nd.getTime() > maxSelectableDate.getTime()) return; // disallow moving beyond deadline
            }
        } catch {}
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
        setIsShiftCalendarOpen(false);
    };

    // format helpers
    const normalizeIso = (raw?: string | null) => {
        if (!raw) return null;
        try {
            let s = String(raw).trim();
            if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T');
            const d = new Date(s);
            if (isNaN(d.getTime())) return null;
            return d;
        } catch {
            return null;
        }
    };

    // format a Date-like string into 'HH:MM'
    // format a Date-like string into 'HH:MM'
    const formatTime = (raw?: string | null) => {
        const d = normalizeIso(raw);
        if (!d) return '未設定';
        const hh = String(d.getHours()); // no leading zero
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    };

    // format a Date-like string into 'YYYY/MM/DD'
    // format a Date-like string into 'YYYY/MM/DD'
    const formatDateOnly = (raw?: string | null) => {
        const d = normalizeIso(raw);
        if (!d) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1); // no leading zero
        const dd = String(d.getDate()); // no leading zero
        return `${yyyy}/${mm}/${dd}`;
    };

    // format a Date-like string into 'YYYY/MM/DD HH:MM'
    // format a Date-like string into 'YYYY/MM/DD HH:MM'
    const formatDateTime = (raw?: string | null) => {
        const d = normalizeIso(raw);
        if (!d) return '未設定';
        const m = String(d.getMonth() + 1); // no leading zero
        const dd = String(d.getDate()); // no leading zero
        const hh = String(d.getHours()); // no leading zero
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${m}/${dd} ${hh}:${min}`;
    };

    // format task row time according to rules:
    // - if only start: show "M/D"
    // - if start and end on same day: show "M/D H:mm - H:mm"
    // - if start and end on different days: show "M/D H:mm - M/D H:mm"
    const formatTaskRowTime = (task: any) => {
        const s = normalizeIso(task.start_at);
        const e = normalizeIso(task.end_at);
        if (!s) return '';
        const sm = String(s.getMonth() + 1);
        const sd = String(s.getDate());
        const sh = String(s.getHours());
        const smin = String(s.getMinutes()).padStart(2, '0');
        if (!e) {
            return `${sm}/${sd}`;
        }
        const eh = String(e.getHours());
        const emin = String(e.getMinutes()).padStart(2, '0');
        const sameDay = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
        if (sameDay) {
            return `${sm}/${sd} ${sh}:${smin} - ${eh}:${emin}`;
        }
        const em = String(e.getMonth() + 1);
        const ed = String(e.getDate());
        return `${sm}/${sd} ${sh}:${smin} - ${em}/${ed} ${eh}:${emin}`;
    };

    // render task status as a localized badge
    const renderTaskStatusBadge = (status?: any) => {
        const s = status == null ? '' : String(status).trim();
        const key = s.toLowerCase();
        let label = s || '未設定';
        let variant: 'default' | 'outline' = 'outline';
        let extra = '';

        switch (key) {
            case 'completed':
            case 'done':
            case '完了':
                label = '完了';
                variant = 'default';
                extra = 'bg-green-100 text-green-800';
                break;
            case 'in_progress':
            case 'in-progress':
            case '進行中':
            case 'ongoing':
                label = '進行中';
                variant = 'default';
                extra = 'bg-yellow-100 text-yellow-800';
                break;
            case 'not_started':
            case 'pending':
            case '未着手':
                label = '未着手';
                variant = 'outline';
                extra = 'bg-gray-100 text-gray-800';
                break;
            case 'cancelled':
            case 'canceled':
            case 'キャンセル':
                label = 'キャンセル';
                variant = 'outline';
                extra = 'bg-red-100 text-red-800';
                break;
            default:
                if (!s) {
                    label = '未設定';
                } else {
                    // keep original text for unknown statuses
                    label = s;
                }
                variant = 'outline';
                extra = '';
        }

        return (
            <Badge variant={variant} className={`text-xs font-medium ${extra}`}>
                {label}
            </Badge>
        );
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

    // transport request visibility window: only from (today - 2 days) up to today (future dates excluded)
    const todayOnly = new Date();
    todayOnly.setHours(0, 0, 0, 0);
    const limitDate = new Date(todayOnly);
    limitDate.setDate(limitDate.getDate() - 2);
    const currentOnly = new Date(currentDate);
    currentOnly.setHours(0, 0, 0, 0);
    const withinTransportWindow = currentOnly.getTime() >= limitDate.getTime() && currentOnly.getTime() <= todayOnly.getTime();

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
                <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}`}</style>
                {/* お知らせエリア */}
                <div className="my-6">
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>お知らせ</CardTitle>
                            {canCreateAnnouncements && (
                                <Button
                                    onClick={() => {
                                        setCreateOpen(true);
                                    }}
                                >
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">新規作成</span>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {announcements.length === 0 ? (
                                <p>現在、新しいお知らせはありません。</p>
                            ) : (
                                <div>
                                    {announcements.map((a) => {
                                        const d = new Date(a.created_at || a.createdAt || Date.now());
                                        const dateLabel = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
                                            d.getDate(),
                                        ).padStart(2, '0')}`;
                                        const expanded = expandedAnnouncementId === Number(a.id);
                                        return (
                                            <div key={a.id} className="border-b border-gray-100">
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-expanded={expanded}
                                                    onClick={async () => {
                                                        const nextExpanded = expanded ? null : Number(a.id);
                                                        setExpandedAnnouncementId(nextExpanded);
                                                        if (nextExpanded && !a.read_by_current_user) {
                                                            try {
                                                                await axios.post(`/api/announcements/${a.id}/read`);
                                                            } catch {}
                                                            setAnnouncements((cur) =>
                                                                cur.map((it) =>
                                                                    Number(it.id) === Number(a.id) ? { ...it, read_by_current_user: true } : it,
                                                                ),
                                                            );
                                                        }
                                                    }}
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            const nextExpanded = expanded ? null : Number(a.id);
                                                            setExpandedAnnouncementId(nextExpanded);
                                                            if (nextExpanded && !a.read_by_current_user) {
                                                                try {
                                                                    await axios.post(`/api/announcements/${a.id}/read`);
                                                                } catch {}
                                                                setAnnouncements((cur) =>
                                                                    cur.map((it) =>
                                                                        Number(it.id) === Number(a.id) ? { ...it, read_by_current_user: true } : it,
                                                                    ),
                                                                );
                                                            }
                                                        }
                                                    }}
                                                    className="flex cursor-pointer items-start gap-2 py-2 hover:bg-gray-50 md:gap-4"
                                                >
                                                    <div className="flex-shrink-0 text-xs text-indigo-600 md:w-28 md:text-sm md:font-medium">
                                                        {dateLabel}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex min-w-0 items-center justify-between">
                                                            <div className="min-w-0 text-xs font-medium break-words break-all whitespace-normal text-gray-800 md:text-sm">
                                                                <div className="break-words break-all">{a.title}</div>
                                                            </div>
                                                            {(() => {
                                                                try {
                                                                    const readByMe = Boolean(
                                                                        a.read_by_current_user === true ||
                                                                            a.readByCurrentUser === true ||
                                                                            a.read_by_current_user === 1,
                                                                    );
                                                                    if (!readByMe) {
                                                                        return (
                                                                            <span className="ml-2 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                                                                                New
                                                                            </span>
                                                                        );
                                                                    }
                                                                } catch {
                                                                    return null;
                                                                }
                                                                return null;
                                                            })()}
                                                            {/* 投稿者の場合は編集・削除アイコンを表示 */}
                                                            {auth && auth.user && Number(auth.user.id) === Number(a.user_id ?? a.user?.id) ? (
                                                                <div className="ml-2 flex items-center gap-2">
                                                                    <button
                                                                        title="編集"
                                                                        className="text-gray-600 hover:text-gray-900"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingAnnouncement(a);
                                                                        }}
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                                {expanded && (
                                                    <div className="px-2 pt-1 pb-4 text-sm text-gray-700">
                                                        <div>{renderContentWithLinks(a.content)}</div>
                                                        {/* 削除は展開内のみ表示（誤操作防止） */}
                                                        {auth && auth.user && Number(auth.user.id) === Number(a.user_id ?? a.user?.id) ? (
                                                            <div className="mt-3 flex justify-end">
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (!confirm('本当に削除しますか？')) return;
                                                                        try {
                                                                            await axios.delete(`/api/announcements/${a.id}`);
                                                                            setAnnouncements((cur) =>
                                                                                cur.filter((it) => Number(it.id) !== Number(a.id)),
                                                                            );
                                                                            setToast({ message: 'お知らせを削除しました', type: 'success' });
                                                                            setTimeout(() => setToast(null), 3000);
                                                                        } catch {
                                                                            setToast({ message: '削除に失敗しました', type: 'error' });
                                                                            setTimeout(() => setToast(null), 3000);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash className="mr-0 h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="mt-2 text-xs text-muted-foreground" />
                            <div className="mt-3 flex items-center justify-center">
                                {totalAnnouncements === null ? (
                                    <Button
                                        variant="outline"
                                        onClick={async () => {
                                            const next = annPage + 1;
                                            await loadAnnouncements(next, true);
                                        }}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? '読み込み中...' : 'もっとみる'}
                                    </Button>
                                ) : announcements.length < (totalAnnouncements ?? 0) ? (
                                    <Button
                                        variant="outline"
                                        onClick={async () => {
                                            const next = annPage + 1;
                                            await loadAnnouncements(next, true);
                                        }}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? '読み込み中...' : 'もっとみる'}
                                    </Button>
                                ) : (
                                    <div className="text-sm text-muted-foreground">これ以上、お知らせはありません</div>
                                )}
                            </div>
                            <div className="my-3">
                                {unreadPosts.length > 0 ? (
                                    <div className="mb-3 rounded border border-gray-200 bg-yellow-50 p-3">
                                        <p className="text-bold mb-2 text-sm">
                                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>未読の投稿があります
                                        </p>
                                        <ul className="space-y-1">
                                            {unreadPosts.map((p) => (
                                                <li key={p.id}>
                                                    <button
                                                        onClick={() => (window.location.href = route('posts.show', p.id) as unknown as string)}
                                                        className="w-full truncate text-left text-sm text-sky-600 hover:underline"
                                                    >
                                                        {'#' + p.id + ' ' + (p.title || '（タイトルなし）')}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                {/* シフトエリア */}
                <div>
                    <Card>
                        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <CardTitle className="text-base sm:text-xl">{formattedDate} のシフト</CardTitle>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                {canViewShifts && (
                                    <Button
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            const d = new Date(currentDate);
                                            const pad = (n: number) => String(n).padStart(2, '0');
                                            const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                                            // navigate to daily timeline for the currently displayed date
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
                                        {currentDate.getFullYear() === new Date().getFullYear() &&
                                        currentDate.getMonth() === new Date().getMonth() &&
                                        currentDate.getDate() === new Date().getDate()
                                            ? '本日のシフト'
                                            : `${currentDate.getMonth() + 1}/${currentDate.getDate()} のシフト`}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={() => {
                                        try {
                                            router.get(route('my-shifts.index'));
                                        } catch {
                                            window.location.href = route('my-shifts.index');
                                        }
                                    }}
                                >
                                    自分のシフトを確認
                                </Button>

                                {/* 送迎申請モーダルを開く（車所持かつ申請期間内かつ当日のシフトに含まれるユーザーのみ表示） */}
                                {(() => {
                                    const canActAsDriver =
                                        (auth && auth.user && (auth.user.has_car === 1 || auth.user.has_car === true)) || hasCarFlag;
                                    const userId = auth && auth.user ? Number(auth.user.id) : null;
                                    const isUserInShifts =
                                        userId !== null &&
                                        Array.isArray(shifts) &&
                                        shifts.some((s: any) => Number(s.user?.id ?? s.user_id ?? 0) === userId);
                                    const showTransportControl = Boolean(canActAsDriver && withinTransportWindow && isUserInShifts);
                                    if (!showTransportControl) return null;
                                    return (
                                        <>
                                            {hasTransportRequestForDate ? (
                                                <Badge variant="outline" className="w-full justify-center sm:w-auto">
                                                    送迎申請済
                                                </Badge>
                                            ) : (
                                                <TransportRequestModal
                                                    dateIso={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(
                                                        currentDate.getDate(),
                                                    ).padStart(2, '0')}`}
                                                    trigger={
                                                        <Button variant="outline" className="w-full sm:w-auto">
                                                            送迎申請
                                                        </Button>
                                                    }
                                                    onSuccess={(m) => {
                                                        setToast({ message: m, type: 'success' });
                                                        setTimeout(() => setToast(null), 3500);
                                                        // re-fetch to determine if both directions are now requested by current user
                                                        (async () => {
                                                            const both = await fetchTransportBothForDate(currentDate);
                                                            setHasTransportRequestForDate(Boolean(both));
                                                        })();
                                                    }}
                                                />
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Popover open={isShiftCalendarOpen} onOpenChange={setIsShiftCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="icon">
                                            <CalendarIcon className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={currentDate}
                                            onSelect={(date) => {
                                                if (!date) {
                                                    handleDateSelect(date);
                                                    return;
                                                }
                                                const pad = (n: number) => String(n).padStart(2, '0');
                                                const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

                                                // Check if date is published
                                                if (!publishedDatesSet.has(dateKey)) {
                                                    // ignore selection of unpublished dates
                                                    return;
                                                }

                                                if (maxSelectableDate) {
                                                    const d = new Date(date);
                                                    d.setHours(0, 0, 0, 0);
                                                    if (d.getTime() > maxSelectableDate.getTime()) {
                                                        // ignore selection beyond deadline
                                                        return;
                                                    }
                                                }
                                                handleDateSelect(date);
                                            }}
                                            initialFocus
                                            locale={ja}
                                            toDate={maxSelectableDate ?? undefined}
                                            disabled={(date) => {
                                                const pad = (n: number) => String(n).padStart(2, '0');
                                                const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
                                                // Disable if not published
                                                if (!publishedDatesSet.has(dateKey)) return true;
                                                // Disable if after max selectable date
                                                if (maxSelectableDate) {
                                                    const d = new Date(date);
                                                    d.setHours(0, 0, 0, 0);
                                                    return d.getTime() > maxSelectableDate.getTime();
                                                }
                                                return false;
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                                {/*【追加】本日ボタンを配置*/}
                                <Button variant="outline" onClick={goToToday}>
                                    本日
                                </Button>
                                <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                {!(
                                    maxSelectableDate &&
                                    (() => {
                                        const d = new Date(currentDate);
                                        d.setHours(0, 0, 0, 0);
                                        return d.getTime() >= maxSelectableDate.getTime();
                                    })()
                                ) && (
                                    <Button variant="outline" size="icon" onClick={goToNextDay}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* 注意書き：送迎申請ボタンが表示されている場合にのみ案内を表示 */}
                            {((auth && auth.user && (auth.user.has_car === 1 || auth.user.has_car === true)) || hasCarFlag) &&
                                withinTransportWindow && (
                                    <div className="mb-4 ml-3 text-xs text-muted-foreground">
                                        ※送迎申請は車を所持しているユーザーが行ってください。
                                        <br />
                                        ※当日～2日前までの申請が可能です。
                                        <br />
                                        ※送迎申請ボタンは、表示日のシフトに登録されているユーザーのみ表示されます。
                                    </div>
                                )}
                            {shifts.length === 0 ? (
                                <div className="text-sm text-muted-foreground">この日のシフトはありません</div>
                            ) : (
                                <div>
                                    {/* Desktop View */}
                                    <div>
                                        <div className="flex">
                                            {/* left fixed column outside horizontal scroller */}
                                            <div className="w-28 flex-shrink-0 text-xs md:w-44">
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
                                                    className="hide-scrollbar"
                                                    style={{
                                                        maxHeight: 'calc(100vh - 220px)',
                                                        overflowY: 'auto',
                                                        overflowX: 'hidden',
                                                        msOverflowStyle: 'none',
                                                        scrollbarWidth: 'none',
                                                    }}
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
                                                                    className={`flex h-10 items-center truncate border-b px-2 text-[10px] md:text-sm md:font-medium ${isCurrentUser ? 'bg-blue-50' : 'bg-white'}`}
                                                                >
                                                                    <span
                                                                        className={`mr-2 inline-block text-right font-mono md:w-12 ${absent ? 'text-gray-500 line-through' : ''}`}
                                                                    >
                                                                        {String(s.user?.position ?? s.user_id)}
                                                                    </span>
                                                                    <div className="flex min-w-0 items-center">
                                                                        <span
                                                                            className={
                                                                                (absent ? 'text-gray-500 line-through ' : '') +
                                                                                'min-w-0 flex-1 truncate'
                                                                            }
                                                                        >
                                                                            {s.user?.name ?? '—'}
                                                                        </span>
                                                                        {((s.user && (s.user.has_car === 1 || s.user.has_car === true)) ||
                                                                            s.has_car === 1 ||
                                                                            s.has_car === true) && (
                                                                            <Car
                                                                                className="ml-2 h-4 w-4 flex-shrink-0 text-gray-600"
                                                                                aria-label="車あり"
                                                                                aria-hidden={false}
                                                                            />
                                                                        )}
                                                                    </div>
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

                {/* 予定エリア */}
                {canViewTasks && (
                    <div className="my-6">
                        <Card>
                            <CardHeader className="flex flex-wrap items-center justify-between md:flex-row">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-ms sm:text-xl">{formattedDate} の予定</CardTitle>
                                    {canViewTasks && (
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                try {
                                                    router.get(route('tasks.calendar'));
                                                } catch {
                                                    window.location.href = route('tasks.calendar');
                                                }
                                            }}
                                        >
                                            カレンダー
                                        </Button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-sm text-muted-foreground">{todayTasks.length} 件</div>
                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="icon">
                                                <CalendarIcon className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={currentDate}
                                                onSelect={(date) => {
                                                    if (!date) {
                                                        handleDateSelect(date);
                                                        return;
                                                    }
                                                    if (maxSelectableDate) {
                                                        const d = new Date(date);
                                                        d.setHours(0, 0, 0, 0);
                                                        if (d.getTime() > maxSelectableDate.getTime()) {
                                                            return;
                                                        }
                                                    }
                                                    handleDateSelect(date);
                                                }}
                                                initialFocus
                                                locale={ja}
                                                toDate={maxSelectableDate ?? undefined}
                                                disabled={maxSelectableDate ? { after: maxSelectableDate } : undefined}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Button variant="outline" onClick={goToToday}>
                                        本日
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    {!(
                                        maxSelectableDate &&
                                        (() => {
                                            const d = new Date(currentDate);
                                            d.setHours(0, 0, 0, 0);
                                            return d.getTime() >= maxSelectableDate.getTime();
                                        })()
                                    ) && (
                                        <Button variant="outline" size="icon" onClick={goToNextDay}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {todayTasks.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">この日の予定はありません</div>
                                ) : (
                                    <div>
                                        {todayTasks.map((t) => {
                                            const expanded = expandedTaskId === Number(t.id);
                                            return (
                                                <div key={t.id} className="border-b border-gray-100">
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-expanded={expanded}
                                                        onClick={async () => {
                                                            const next = expanded ? null : Number(t.id);
                                                            setExpandedTaskId(next);
                                                            // optionally mark as viewed or fetch details if needed
                                                            if (next) {
                                                                try {
                                                                    // fetch detail to ensure up-to-date description/status
                                                                    const res = await axios.get(`/api/tasks/${t.id}`);
                                                                    const detail = res.data || {};
                                                                    setTodayTasks((cur) =>
                                                                        cur.map((it) => (Number(it.id) === Number(t.id) ? { ...it, ...detail } : it)),
                                                                    );
                                                                } catch {}
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                const next = expanded ? null : Number(t.id);
                                                                setExpandedTaskId(next);
                                                            }
                                                        }}
                                                        className="flex cursor-pointer items-start gap-2 py-3 hover:bg-gray-50 md:gap-4"
                                                    >
                                                        <div className="flex w-14 flex-shrink-0 items-center gap-2 md:w-28">
                                                            {/* color swatch */}
                                                            {(t.category && t.category.color) || t.category_color ? (
                                                                <div
                                                                    aria-hidden
                                                                    className="w-1 flex-shrink-0 self-stretch rounded"
                                                                    style={{
                                                                        background: ((): string | undefined => {
                                                                            const raw = (t.category && t.category.color) || t.category_color;
                                                                            if (!raw) return undefined;
                                                                            const s = String(raw).trim();
                                                                            if (s.startsWith('#')) return s;
                                                                            if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
                                                                            return s;
                                                                        })(),
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-1 flex-shrink-0" />
                                                            )}
                                                            <div className="self-center truncate text-xs md:text-sm md:font-medium">
                                                                {t.category && t.category.name ? t.category.name : 'カテゴリなし'}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex min-w-0 items-center justify-between">
                                                                <div className="min-w-0 text-xs font-medium break-words break-all whitespace-normal text-gray-800 md:text-sm">
                                                                    <div className="break-words break-all">{t.title}</div>
                                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                                        {Array.isArray(t.assignees) && t.assignees.length > 0
                                                                            ? t.assignees.map((a: any) => a.name || a).join(', ')
                                                                            : t.assignees && t.assignees.name
                                                                              ? t.assignees.name
                                                                              : '担当者なし'}
                                                                    </div>
                                                                </div>
                                                                <div className="ml-2 text-right text-xs text-muted-foreground">
                                                                    <div>{renderTaskStatusBadge(t.status)}</div>
                                                                    <div className="mt-1">{formatTaskRowTime(t)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {expanded && (
                                                        <div className="px-2 pt-1 pb-4 text-sm text-gray-700">
                                                            <div>{t.description ? renderContentWithLinks(t.description) : '詳細はありません'}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Create Announcement Modal */}
                {createOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setCreateOpen(false)} />
                        <div className="relative z-10 w-full max-w-xl rounded bg-white p-4 shadow-lg">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">新しいお知らせを作成</h3>
                                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                                    閉じる
                                </Button>
                            </div>
                            <CreateAnnouncementForm
                                onCancel={() => setCreateOpen(false)}
                                onCreated={(item: any) => {
                                    // 新規作成時は先頭に挿入し、ページ状態を1に戻す
                                    setAnnouncements((cur) => [item].concat(cur));
                                    setAnnPage(1);
                                    setCreateOpen(false);
                                    setToast({ message: 'お知らせを作成しました', type: 'success' });
                                    setTimeout(() => setToast(null), 3000);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {/* Edit modal */}
            {editingAnnouncement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setEditingAnnouncement(null)} />
                    <div className="relative z-10 w-full max-w-xl rounded bg-white p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">お知らせを編集</h3>
                            <Button variant="ghost" onClick={() => setEditingAnnouncement(null)}>
                                閉じる
                            </Button>
                        </div>
                        <CreateAnnouncementForm
                            initial={editingAnnouncement}
                            onCancel={() => setEditingAnnouncement(null)}
                            onUpdated={(item: any) => {
                                setAnnouncements((cur) => cur.map((it) => (Number(it.id) === Number(item.id) ? item : it)));
                                setEditingAnnouncement(null);
                                setToast({ message: 'お知らせを更新しました', type: 'success' });
                                setTimeout(() => setToast(null), 3000);
                            }}
                        />
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

// Render plain text content but convert URLs to clickable links
function renderContentWithLinks(content?: string) {
    if (!content) return null;
    // simple URL regex (http/https)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    const nodes: any[] = [];

    parts.forEach((part, idx) => {
        if (!part) return;
        if (urlRegex.test(part)) {
            // reset lastIndex in case of global regex
            urlRegex.lastIndex = 0;
            nodes.push(
                <a
                    key={`link-${idx}`}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    // single-line truncate: ensure the anchor is a block-level inline-block that can truncate
                    className="inline-block w-full max-w-full truncate overflow-hidden whitespace-nowrap text-sky-600 underline hover:text-sky-800"
                >
                    {part}
                </a>,
            );
        } else {
            // preserve line breaks
            const lines = part.split('\n');
            lines.forEach((line, i) => {
                nodes.push(
                    <span key={`text-${idx}-${i}`} className="break-words">
                        {line}
                    </span>,
                );
                if (i < lines.length - 1) nodes.push(<br key={`br-${idx}-${i}`} />);
            });
        }
    });

    return nodes;
}

// Simple form component for creating announcements
function CreateAnnouncementForm({
    onCreated,
    onCancel,
    initial,
    onUpdated,
}: {
    onCreated?: (a: any) => void;
    onCancel: () => void;
    initial?: any;
    onUpdated?: (a: any) => void;
}) {
    const [title, setTitle] = useState(initial?.title ?? '');
    const [content, setContent] = useState(initial?.content ?? '');
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        if (!title.trim() || !content.trim()) return;
        setLoading(true);
        try {
            if (initial && initial.id && onUpdated) {
                // update
                const res = await axios.post(`/api/announcements/${initial.id}`, { title: title.trim(), content: content.trim() });
                const item = (res.data && res.data.announcement) || null;
                if (item) onUpdated(item);
            } else {
                const res = await axios.post('/api/announcements', { title: title.trim(), content: content.trim() });
                const item = (res.data && res.data.announcement) || null;
                if (item && onCreated) onCreated(item);
            }
        } catch {
            // ignore for now
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-3">
            <div className="mb-2">
                <label className="mb-1 block text-sm">タイトル</label>
                <input className="w-full rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="mb-2">
                <label className="mb-1 block text-sm">内容</label>
                <textarea className="w-full rounded border px-2 py-1" rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>
                    キャンセル
                </Button>
                <Button onClick={submit} disabled={loading || !title.trim() || !content.trim()}>
                    作成
                </Button>
            </div>
        </div>
    );
}
