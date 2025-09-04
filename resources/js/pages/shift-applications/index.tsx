import HeadingSmall from '@/components/heading-small';
import LeaveApplicationModal from '@/components/shifts/leave-application-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem, PageProps, PaginatedResponse } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { LoaderCircle, Plus, Trash } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: '各種申請', href: route('shift-applications.index') }];

const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    return (
        <Link href={route('shift-applications.index', { sort: sort_key, direction: newDirection })} preserveState preserveScroll>
            <div className={`flex items-center gap-2 ${isCurrentSort ? 'text-indigo-600' : 'text-muted-foreground'}`}>
                <span>{children}</span>
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {isCurrentSort ? (
                        currentDirection === 'asc' ? (
                            <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        )
                    ) : (
                        <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                    )}
                </svg>
            </div>
        </Link>
    );
};

export default function Index({
    applications: initialApplications,
    queryParams = {},
}: PageProps<{ applications: PaginatedResponse<any>; queryParams: any }>) {
    const [items, setItems] = useState(initialApplications.data);
    const [nextPageUrl, setNextPageUrl] = useState(initialApplications.next_page_url);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setItems(initialApplications.data);
        setNextPageUrl(initialApplications.next_page_url);
    }, [initialApplications]);

    // only show applications of type 'leave' in the vacation list
    const leaveItems = useMemo(() => {
        try {
            return (items || []).filter((a: any) => a && (a.type === 'leave' || String(a.type) === 'leave'));
        } catch (e) {
            return [];
        }
    }, [items]);

    const loadMore = () => {
        if (!nextPageUrl) return;

        setLoading(true);
        router.get(
            nextPageUrl,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    const newItems = (page.props.applications as PaginatedResponse<any>).data;
                    const nextPage = (page.props.applications as PaginatedResponse<any>).next_page_url;
                    setItems((prev) => [...prev, ...newItems]);
                    setNextPageUrl(nextPage);
                    setLoading(false);
                },
                onError: () => setLoading(false),
            },
        );
    };

    const confirmAndDelete = (app: any) => {
        if (!confirm(`申請「${app.id}」を削除してもよろしいですか？この操作は取り消せません。`)) return;
        router.delete(route('shift-applications.destroy', app.id), { preserveState: false });
    };

    const page = usePage();
    const props = page.props as any;
    // debug: log relevant server props to verify they're sent on month change
    const { permissions } = props;
    const authUser = props?.auth?.user;

    const canCreate = permissions?.shift_application?.create || permissions?.is_system_admin;
    const canUpdate = permissions?.shift_application?.update || permissions?.is_system_admin;
    const canDelete = permissions?.shift_application?.delete || permissions?.is_system_admin;
    // calendar props from server (may be undefined for older calls)
    const { month, holidays = [], currentUserLeave = null, application_deadline_days = 0, userShiftDates = [] } = props || {};
    const shiftDetails = useMemo(() => ((page.props as any).shiftDetails || []) as any[], [page.props]);
    const shiftDetailsMap = useMemo(() => {
        const m: Record<string, { start_time?: string; end_time?: string }> = {};
        (shiftDetails || []).forEach((s: any) => {
            if (s && s.date) m[String(s.date)] = s;
        });
        return m;
    }, [shiftDetails]);

    // parse month prop (YYYY-MM-DD) into a local Date to avoid UTC offset issues
    const monthDate = useMemo(() => {
        if (!month) return new Date();
        const parts = String(month)
            .split('-')
            .map((p) => parseInt(p, 10));
        if (parts.length >= 2) return new Date(parts[0], parts[1] - 1, 1);
        return new Date(month);
    }, [month]);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalDate, setModalDate] = useState('');
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
    const [localUserLeaves, setLocalUserLeaves] = useState<string[]>(props.userLeaves || []);
    // local copy of remaining leave days (null === unlimited)
    const [localRemainingDays, setLocalRemainingDays] = useState<number | null>(() => {
        try {
            // use explicit nullish coalescing so that 0 is preserved (0 is falsy but valid)
            const r = props && props.currentUserLeave ? props.currentUserLeave.remaining : null;
            return r === null || typeof r === 'undefined' ? null : Number(r);
        } catch (e) {
            return null;
        }
    });
    // track locally-marked step_out dates so UI updates immediately without a full reload
    const [localStepOutDates, setLocalStepOutDates] = useState<string[]>(() => {
        try {
            const sdAll = (page.props as any).shiftDetails || [];
            return sdAll
                .filter((s: any) => {
                    if (!s) return false;
                    const top = s.step_out;
                    const nested = s.shift && (s.shift.step_out ?? s.shift?.step_out);
                    return top === 1 || top === '1' || nested === 1 || nested === '1';
                })
                .map((s: any) => s.date || s.date);
        } catch (_) {
            return [];
        }
    });
    // track locally-marked meal_ticket=0 dates so UI updates immediately
    const [localMealTicketDates, setLocalMealTicketDates] = useState<string[]>(() => {
        try {
            const sdAll = (page.props as any).shiftDetails || [];
            return sdAll
                .filter((s: any) => {
                    if (!s) return false;
                    const top = s.meal_ticket;
                    const nested = s.shift && (s.shift.meal_ticket ?? s.shift?.meal_ticket);
                    return top === 0 || top === '0' || nested === 0 || nested === '0';
                })
                .map((s: any) => s.date || s.date);
        } catch (e) {
            return [];
        }
    });

    const startOfMonth = useMemo(() => new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), [monthDate]);
    const endOfMonth = useMemo(() => new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0), [monthDate]);

    const daysInMonth = useMemo(() => {
        const days: Date[] = [];
        for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }
        return days;
    }, [startOfMonth, endOfMonth]);

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatMd = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;

    // Format a Date to local YYYY-MM-DD (avoid toISOString which converts to UTC)
    const formatLocalIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const formatTimeShort = (hhmm: string) => {
        // input 'HH:MM' -> output without leading zero hour 'H:MM' or original if malformed
        if (!hhmm || typeof hhmm !== 'string') return hhmm;
        const parts = hhmm.split(':');
        if (parts.length < 2) return hhmm;
        const h = String(parseInt(parts[0], 10));
        const m = parts[1];
        return `${h}:${m}`;
    };

    const isHoliday = (d: Date) => holidays.includes(formatLocalIso(d));

    const isPastOrToday = (d: Date) => {
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return t.getTime() <= today.getTime();
    };

    const formatMonthParam = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    };

    const prevMonth = () => {
        const m = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
        router.get(
            route('shift-applications.index'),
            { month: formatMonthParam(m) },
            {
                only: [
                    'month',
                    'holidays',
                    'currentUserLeave',
                    'application_deadline_days',
                    'applications',
                    'queryParams',
                    'shiftDetails',
                    'userLeaves',
                    'userShiftDates',
                ],
            },
        );
    };

    const nextMonth = () => {
        const m = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
        router.get(
            route('shift-applications.index'),
            { month: formatMonthParam(m) },
            {
                only: [
                    'month',
                    'holidays',
                    'currentUserLeave',
                    'application_deadline_days',
                    'applications',
                    'queryParams',
                    'shiftDetails',
                    'userLeaves',
                    'userShiftDates',
                ],
            },
        );
    };

    /*
    const canImmediateChange = (target: Date) => {
        if (!application_deadline_days) return true; // 0 => unlimited immediate
        const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        // application_deadline_days = 5 means: up to 5 days from today (inclusive) requires an application.
        // only allow immediate change when daysUntil is strictly greater than the deadline.
        return daysUntil > application_deadline_days || (permissions && permissions.is_system_admin);
    };
    */

    const postImmediateLeave = async (dateStr: string) => {
        // call mark-break endpoint to create Shift + ShiftDetail(type=break)
        if (!authUser) {
            setToast({ message: 'ログイン情報が取得できません。', type: 'error' });
            return;
        }
        // check remaining locally
        if (localRemainingDays !== null && localRemainingDays <= 0) {
            setToast({ message: '残りの休暇が不足しているため登録できません。', type: 'error' });
            return;
        }
        try {
            await axios.post(route('shifts.mark_break'), { user_id: authUser.id, date: dateStr });
            // update local leaves so UI reflects change without full reload
            setLocalUserLeaves((prev) => (prev.includes(dateStr) ? prev : [...prev, dateStr]));
            // decrement remaining locally if numeric, but skip weekends/holidays
            try {
                const d = new Date(dateStr);
                const isWeekendOrHoliday = isHoliday(d) || d.getDay() === 0 || d.getDay() === 6;
                if (!isWeekendOrHoliday) setLocalRemainingDays((prev) => (prev === null ? null : prev - 1));
            } catch {}
            setToast({ message: '休暇に変更しました。', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: '休暇に変更できませんでした。', type: 'error' });
        }
    };

    // listen for leave creations from modal and update local state (skip weekends/holidays)
    useEffect(() => {
        const handler = (e: any) => {
            try {
                const dateStr = e?.detail?.date;
                if (!dateStr) return;
                const d = new Date(dateStr);
                const isWeekendOrHoliday = isHoliday(d) || d.getDay() === 0 || d.getDay() === 6;
                setLocalUserLeaves((prev) => (prev.includes(dateStr) ? prev : [...prev, dateStr]));
                if (!isWeekendOrHoliday) setLocalRemainingDays((prev) => (prev === null ? null : prev - 1));
            } catch {
                // ignore
            }
        };
        if (typeof window !== 'undefined') window.addEventListener('leave:created', handler as EventListener);
        return () => {
            if (typeof window !== 'undefined') window.removeEventListener('leave:created', handler as EventListener);
        };
    }, [isHoliday]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="各種申請" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="各種申請" description="中抜け・休暇・食券不要の申請" />
                </div>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>休暇申請一覧</CardTitle>
                        {canCreate &&
                            // disable create when remaining days is numeric and <= 0
                            (localRemainingDays !== null && localRemainingDays <= 0 ? (
                                <Button disabled title="残りの休暇が不足しているため申請できません">
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">申請する</span>
                                </Button>
                            ) : (
                                <Link href={route('shift-applications.create')}>
                                    <Button>
                                        <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">申請する</span>
                                    </Button>
                                </Link>
                            ))}
                    </CardHeader>
                    <CardContent>
                        {!leaveItems || leaveItems.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">申請がありません</div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {permissions?.is_system_admin && <TableHead>ユーザー</TableHead>}
                                            <TableHead>
                                                <SortableHeader sort_key="date" queryParams={queryParams}>
                                                    日付
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead>理由</TableHead>
                                            <TableHead className="text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leaveItems.map((a: any) => (
                                            <TableRow key={a.id} className="hover:bg-gray-50">
                                                {permissions?.is_system_admin && <TableCell>{a.user ? a.user.name : '—'}</TableCell>}
                                                <TableCell>
                                                    {(() => {
                                                        try {
                                                            const d = new Date(a.date);
                                                            const m = d.getMonth() + 1;
                                                            const dd = d.getDate();
                                                            const jp = ['日', '月', '火', '水', '木', '金', '土'];
                                                            return `${m}/${dd} (${jp[d.getDay()]})`;
                                                        } catch (e) {
                                                            return a.date || '—';
                                                        }
                                                    })()}
                                                </TableCell>
                                                <TableCell className="max-w-xs break-words whitespace-pre-line">{a.reason || '—'}</TableCell>
                                                <TableCell className="text-right">
                                                    {(canDelete || (authUser && a.user_id === authUser.id)) && (
                                                        <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(a)}>
                                                            <Trash className="mr-2 h-4 w-4" /> 削除
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {nextPageUrl && (
                                    <div className="mt-6 text-center">
                                        <Button onClick={loadMore} disabled={loading} variant="outline">
                                            {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                            もっとみる
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Vertical calendar view */}
                <div className="mt-6">
                    <Card className="w-full">
                        <CardHeader className="w-full flex-row flex-nowrap items-center justify-between">
                            <div className="flex-shrink-0">
                                <Button size="sm" onClick={prevMonth}>
                                    前の月
                                </Button>
                            </div>
                            <div className="flex-1 px-4 text-center">
                                <CardTitle className="!m-0">
                                    {monthDate.getFullYear()}年 {monthDate.getMonth() + 1}月
                                </CardTitle>
                            </div>
                            <div className="flex-shrink-0">
                                <Button size="sm" onClick={nextMonth}>
                                    次の月
                                </Button>
                            </div>
                        </CardHeader>
                        <div className="sticky top-16 z-20 border-t bg-card px-6 pb-2 text-sm text-muted-foreground">
                            <div className="font-medium">
                                残りの休暇:{' '}
                                {typeof localRemainingDays === 'number' ? `${localRemainingDays}日` : localRemainingDays === null ? '無制限' : '—'}
                            </div>
                            <div className="mt-2 space-y-1">
                                <div className="rounded border-l-4 border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                                    <div>
                                        ・ <strong className="font-semibold">「残りの休暇」</strong>を超えての登録はできません。
                                    </div>
                                    <div className="mt-1">
                                        ・<strong className="font-semibold">休暇登録</strong>は基本的に{application_deadline_days}
                                        日前までに行ってください。
                                    </div>
                                    <div className="mt-1">
                                        ・{application_deadline_days}日前を過ぎた場合、既にシフトが登録されている場合は
                                        <strong className="font-semibold">休暇申請</strong>が行えません。
                                    </div>
                                    <div className="mt-1">
                                        ・土日祝日は基本的に出勤していただきますが、事情がある場合は社員に直接連絡してください。
                                    </div>
                                    <div className="mt-1">・その他やむを得ない事情がある場合、社員に直接連絡してください。</div>
                                    <div className="mt-1">
                                        ・<strong className="font-semibold">中抜け申請</strong>は当日の取り消しはできませんのでご注意ください。
                                    </div>
                                    <div className="mt-1">
                                        ・<strong className="font-semibold">食券不要申請</strong>
                                        は2日前までに行ってください。それ以降は受け付けません。
                                    </div>
                                </div>
                            </div>
                        </div>

                        <CardContent className="max-h-[70vh] overflow-y-auto">
                            <div className="flex flex-col">
                                {daysInMonth.map((d) => {
                                    const iso = formatLocalIso(d);
                                    const holiday = isHoliday(d);
                                    // const immediate = canImmediateChange(new Date(d)); // unused
                                    const dayIndex = d.getDay();
                                    // Sunday -> red, Saturday -> blue, holiday -> yellow (if not weekend)
                                    let rowBg = '';
                                    if (dayIndex === 0) rowBg = 'bg-red-50';
                                    else if (dayIndex === 6) rowBg = 'bg-blue-50';
                                    else if (holiday) rowBg = 'bg-red-50';

                                    const isUserLeave = localUserLeaves && localUserLeaves.includes(iso);
                                    const pastOrToday = isPastOrToday(d);
                                    // determine today / past / future
                                    const tDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                    const todayDate = new Date();
                                    todayDate.setHours(0, 0, 0, 0);
                                    const isToday = tDate.getTime() === todayDate.getTime();
                                    const isPastOnly = tDate.getTime() < todayDate.getTime();
                                    // days until target (0 == today)
                                    const daysUntil = Math.ceil((tDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                                    // If application_deadline_days == 0, treat as no deadline (always allow immediate registration)
                                    const withinDeadline = application_deadline_days > 0 && daysUntil <= application_deadline_days;
                                    if (isToday) rowBg = 'bg-green-100';
                                    // show time only when NOT marked as leave. Calculation moved after shift detection to consider deadline window.

                                    // determine date text color: Sunday or holiday => red, Saturday => blue
                                    const dateTextClass = holiday || dayIndex === 0 ? 'text-red-600' : dayIndex === 6 ? 'text-blue-600' : '';

                                    // build a responsive row: left=date(+mobile info), center=desktop info (badge/time), right=actions
                                    const sd = shiftDetailsMap[iso];
                                    const timeStr =
                                        sd && sd.start_time && sd.end_time
                                            ? `${formatTimeShort(sd.start_time.slice(0, 5))}〜${formatTimeShort(sd.end_time.slice(0, 5))}`
                                            : sd
                                              ? '時間未設定'
                                              : null;
                                    const isShiftExists = (userShiftDates || []).includes(iso);
                                    // If application_deadline_days == 0 treat as unlimited
                                    const withinDeadlineOrNoLimit = application_deadline_days === 0 ? true : withinDeadline;
                                    // show time when not on leave and (past/today OR (shift exists and within deadline window))
                                    const showTime = !isUserLeave && (pastOrToday || (isShiftExists && withinDeadlineOrNoLimit));
                                    // detect if the shift for this date already has step_out flag set using local state
                                    // we rely on localStepOutDates (initialized from server) so mark/unmark updates immediately
                                    const isStepOut = (localStepOutDates || []).includes(iso);

                                    return (
                                        <div key={iso} className={`flex items-center justify-between border-b px-4 py-2 ${rowBg}`}>
                                            <div className="flex items-start gap-4">
                                                <div className="w-36 flex-shrink-0">
                                                    <div className={`font-medium ${dateTextClass}`}>{formatMd(d)}</div>
                                                    <div className="mt-1 md:hidden">
                                                        {holiday && <div className="text-xs text-red-600">祝日</div>}
                                                    </div>
                                                </div>

                                                {/* desktop: inline badge/time next to date */}
                                                <div className="hidden flex-1 items-center gap-3 md:flex">
                                                    {isUserLeave && (
                                                        <div className="inline-block rounded bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                                                            休
                                                        </div>
                                                    )}
                                                    {showTime && timeStr && (
                                                        <div
                                                            className={`text-sm ${isPastOnly ? 'text-muted-foreground' : 'font-medium text-sky-700'}`}
                                                        >
                                                            {timeStr}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* mobile: stacked info under date (time below) */}
                                                <div className="flex-1 md:hidden">
                                                    {isUserLeave && (
                                                        <div className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                            休
                                                        </div>
                                                    )}
                                                    {showTime && timeStr && (
                                                        <div
                                                            className={`text-xs ${isPastOnly ? 'text-muted-foreground' : 'font-medium text-sky-700'}`}
                                                        >
                                                            {timeStr}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {(() => {
                                                    // If not pastOrToday, decide actions in this order:
                                                    // 1) If user has a leave already -> show cancel
                                                    // 2) If user has a scheduled shift (出勤日) -> show meal-ticket / 中抜け (regardless of weekend/holiday)
                                                    // 3) If no shift: if withinDeadline -> show 休暇申請 (申請), else -> show 休暇登録
                                                    if (!pastOrToday) {
                                                        if (isUserLeave) {
                                                            // Do not show cancel button when the date is within the application deadline window.
                                                            // application_deadline_days == 0 means no deadline (allow cancel).
                                                            const allowCancel = application_deadline_days === 0 ? true : !withinDeadline;
                                                            const isWeekendOrHoliday = holiday || dayIndex === 0 || dayIndex === 6;
                                                            // hide cancel on weekends/holidays even when allowCancel is true
                                                            if (allowCancel && !isWeekendOrHoliday) {
                                                                return (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={async () => {
                                                                            try {
                                                                                await axios.post(route('shifts.unmark_break'), {
                                                                                    user_id: authUser.id,
                                                                                    date: iso,
                                                                                });
                                                                                setLocalUserLeaves((prev) => prev.filter((x) => x !== iso));
                                                                                // restore remaining day locally
                                                                                setLocalRemainingDays((prev) => (prev === null ? null : prev + 1));
                                                                                setToast({ message: '休暇をキャンセルしました。', type: 'success' });
                                                                            } catch (e) {
                                                                                console.error(e);
                                                                                setToast({
                                                                                    message: '休暇のキャンセルに失敗しました。',
                                                                                    type: 'error',
                                                                                });
                                                                            }
                                                                        }}
                                                                    >
                                                                        キャンセル
                                                                    </Button>
                                                                );
                                                            }
                                                            // otherwise hide the cancel button during application period or on weekends/holidays
                                                            return null;
                                                        }
                                                        // If the user has a scheduled shift on this date, show shift-related actions regardless of weekend/holiday
                                                        if (isShiftExists || (timeStr && timeStr !== '時間未設定')) {
                                                            // meal ticket button on days with shifts
                                                            const hasMealTicketFalse = (() => {
                                                                if (!sd) return false;
                                                                const mt = (sd as unknown as { meal_ticket?: number | string | boolean }).meal_ticket;
                                                                return mt === 0 || mt === '0' || mt === false;
                                                            })();
                                                            const isMealTicket = (localMealTicketDates || []).includes(iso) || hasMealTicketFalse;

                                                            // create meal ticket button element (optimistic handlers)
                                                            // showMealTicketControl: hide meal-ticket control for today and tomorrow (daysUntil <= 1)
                                                            const showMealTicketControl = typeof daysUntil === 'number' ? daysUntil >= 2 : true;
                                                            // only show shift actions (meal-ticket / step-out) when within the application deadline (or no limit)
                                                            const showShiftActionsByDeadline = withinDeadlineOrNoLimit;

                                                            const mealTicketButton =
                                                                showShiftActionsByDeadline && showMealTicketControl ? (
                                                                    isMealTicket ? (
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="sm"
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await axios.post(route('shifts.unmark_meal_ticket'), {
                                                                                        user_id: authUser.id,
                                                                                        date: iso,
                                                                                    });
                                                                                    setLocalMealTicketDates((prev) => prev.filter((d) => d !== iso));
                                                                                    setToast({
                                                                                        message: '食券不要を解除しました。',
                                                                                        type: 'success',
                                                                                    });
                                                                                } catch (err) {
                                                                                    console.error(err);
                                                                                    setToast({
                                                                                        message: '食券不要の解除に失敗しました。',
                                                                                        type: 'error',
                                                                                    });
                                                                                }
                                                                            }}
                                                                        >
                                                                            食券必要
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await axios.post(route('shifts.mark_meal_ticket'), {
                                                                                        user_id: authUser.id,
                                                                                        date: iso,
                                                                                    });
                                                                                    setLocalMealTicketDates((prev) =>
                                                                                        prev.includes(iso) ? prev : [...prev, iso],
                                                                                    );
                                                                                    setToast({
                                                                                        message: '食券不要に設定しました。',
                                                                                        type: 'success',
                                                                                    });
                                                                                } catch (err) {
                                                                                    console.error(err);
                                                                                    setToast({
                                                                                        message: '食券不要に設定できませんでした。',
                                                                                        type: 'error',
                                                                                    });
                                                                                }
                                                                            }}
                                                                        >
                                                                            食券不要
                                                                        </Button>
                                                                    )
                                                                ) : null;

                                                            // render meal ticket button (only when allowed) then render 中抜け controls
                                                            return (
                                                                <>
                                                                    {mealTicketButton}
                                                                    {mealTicketButton ? <div className="w-1" /> : null}
                                                                    {/* 中抜け controls: also gated by deadline */}
                                                                    {showShiftActionsByDeadline ? (
                                                                        isStepOut ? (
                                                                            <Button
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        await axios.post(route('shifts.unmark_step_out'), {
                                                                                            user_id: authUser.id,
                                                                                            date: iso,
                                                                                        });
                                                                                        setLocalStepOutDates((prev) => prev.filter((d) => d !== iso));
                                                                                        setToast({
                                                                                            message: '中抜けを取消しました。',
                                                                                            type: 'success',
                                                                                        });
                                                                                    } catch (err) {
                                                                                        console.error(err);
                                                                                        setToast({
                                                                                            message: '中抜けの取消に失敗しました。',
                                                                                            type: 'error',
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            >
                                                                                中抜け取消
                                                                            </Button>
                                                                        ) : (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        await axios.post(route('shifts.mark_step_out'), {
                                                                                            user_id: authUser.id,
                                                                                            date: iso,
                                                                                        });
                                                                                        setLocalStepOutDates((prev) =>
                                                                                            prev.includes(iso) ? prev : [...prev, iso],
                                                                                        );
                                                                                        setToast({
                                                                                            message: '中抜けに変更しました。',
                                                                                            type: 'success',
                                                                                        });
                                                                                    } catch (err) {
                                                                                        console.error(err);
                                                                                        setToast({
                                                                                            message: '中抜けにできませんでした。',
                                                                                            type: 'error',
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            >
                                                                                中抜け
                                                                            </Button>
                                                                        )
                                                                    ) : null}
                                                                </>
                                                            );
                                                        }

                                                        // No shift exists on this date -> decide between 申請 (withinDeadline) and 登録 (after deadline)
                                                        if (!holiday && dayIndex !== 0 && dayIndex !== 6) {
                                                            if (withinDeadline) {
                                                                // within deadline window: show 休暇申請
                                                                return (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                                                                        onClick={() => {
                                                                            if (localRemainingDays !== null && localRemainingDays <= 0) {
                                                                                setToast({
                                                                                    message: '残りの休暇が不足しているため申請できません。',
                                                                                    type: 'error',
                                                                                });
                                                                                return;
                                                                            }
                                                                            setModalDate(iso);
                                                                            setModalOpen(true);
                                                                        }}
                                                                    >
                                                                        休暇申請
                                                                    </Button>
                                                                );
                                                            }

                                                            // after deadline: show 休暇登録 (immediate)
                                                            return (
                                                                <Button size="sm" onClick={() => postImmediateLeave(iso)}>
                                                                    休暇登録
                                                                </Button>
                                                            );
                                                        }

                                                        return null;
                                                    }

                                                    // pastOrToday: show 中抜け on 当日 only when a shift exists
                                                    if (isToday && isShiftExists) {
                                                        if (isStepOut) {
                                                            return (
                                                                <Button variant="outline" size="sm" disabled>
                                                                    中抜け申請済
                                                                </Button>
                                                            );
                                                        }

                                                        return (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    try {
                                                                        await axios.post(route('shifts.mark_step_out'), {
                                                                            user_id: authUser.id,
                                                                            date: iso,
                                                                        });
                                                                        setLocalStepOutDates((prev) => (prev.includes(iso) ? prev : [...prev, iso]));
                                                                        setToast({ message: '中抜けに変更しました。', type: 'success' });
                                                                    } catch (e) {
                                                                        console.error(e);
                                                                        setToast({ message: '中抜けにできませんでした。', type: 'error' });
                                                                    }
                                                                }}
                                                            >
                                                                中抜け
                                                            </Button>
                                                        );
                                                    }

                                                    return null;
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <LeaveApplicationModal open={modalOpen} onOpenChange={setModalOpen} date={modalDate} />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppSidebarLayout>
    );
}
