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
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, Plus, Trash } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: '休暇申請', href: route('shift-applications.index') },
];

const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    const Icon = isCurrentSort ? (currentDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
        <Link
            href={route('shift-applications.index', { sort: sort_key, direction: newDirection })}
            preserveState
            preserveScroll
            className="flex items-center gap-2"
        >
            {children}
            <Icon className={`h-4 w-4 ${isCurrentSort ? 'text-primary' : 'text-muted-foreground'}`} />
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
    const { permissions } = props;
    const authUser = props?.auth?.user;

    const canCreate = permissions?.shift_application?.create || permissions?.is_system_admin;
    const canUpdate = permissions?.shift_application?.update || permissions?.is_system_admin;
    const canDelete = permissions?.shift_application?.delete || permissions?.is_system_admin;
    // calendar props from server (may be undefined for older calls)
    const { month, holidays = [], currentUserLeave = null, application_deadline_days = 0 } = props || {};
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
            { only: ['month', 'holidays', 'currentUserLeave', 'application_deadline_days', 'applications', 'queryParams'] },
        );
    };

    const nextMonth = () => {
        const m = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
        router.get(
            route('shift-applications.index'),
            { month: formatMonthParam(m) },
            { only: ['month', 'holidays', 'currentUserLeave', 'application_deadline_days', 'applications', 'queryParams'] },
        );
    };

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

    const postImmediateLeave = async (dateStr: string) => {
        // call mark-break endpoint to create Shift + ShiftDetail(type=break)
        if (!authUser) {
            setToast({ message: 'ログイン情報が取得できません。', type: 'error' });
            return;
        }
        try {
            await axios.post(route('shifts.mark_break'), { user_id: authUser.id, date: dateStr });
            // update local leaves so UI reflects change without full reload
            setLocalUserLeaves((prev) => (prev.includes(dateStr) ? prev : [...prev, dateStr]));
            setToast({ message: '休暇に変更しました。', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: '休暇に変更できませんでした。', type: 'error' });
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="休暇申請" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="休暇申請" description="" />
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>申請一覧</CardTitle>
                        {canCreate && (
                            <Link href={route('shift-applications.create')}>
                                <Button>
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">申請する</span>
                                </Button>
                            </Link>
                        )}
                    </CardHeader>
                    <CardContent>
                        {!items || items.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">申請がありません</div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <SortableHeader sort_key="id" queryParams={queryParams}>
                                                    ID
                                                </SortableHeader>
                                            </TableHead>
                                            {permissions?.is_system_admin && <TableHead>ユーザー</TableHead>}
                                            <TableHead>
                                                <SortableHeader sort_key="date" queryParams={queryParams}>
                                                    日付
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead>理由</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((a: any) => (
                                            <TableRow key={a.id} className="hover:bg-gray-50">
                                                <TableCell
                                                    className={canUpdate ? 'cursor-pointer' : ''}
                                                    onClick={() =>
                                                        canUpdate && router.get(route('shift-applications.show', a.id), {}, { preserveScroll: true })
                                                    }
                                                >
                                                    {a.id}
                                                </TableCell>
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
                        <CardHeader className="flex w-full flex-row flex-nowrap items-center justify-between">
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
                            残りの休暇:{' '}
                            {currentUserLeave ? (currentUserLeave.remaining === null ? '無制限' : `${currentUserLeave.remaining}日`) : '—'}
                        </div>

                        <CardContent className="max-h-[70vh] overflow-y-auto">
                            <div className="flex flex-col">
                                {daysInMonth.map((d) => {
                                    const iso = formatLocalIso(d);
                                    const holiday = isHoliday(d);
                                    const immediate = canImmediateChange(new Date(d));
                                    const dayIndex = d.getDay();
                                    // Sunday -> red, Saturday -> blue, holiday -> yellow (if not weekend)
                                    let rowBg = '';
                                    if (dayIndex === 0) rowBg = 'bg-red-50';
                                    else if (dayIndex === 6) rowBg = 'bg-blue-50';
                                    else if (holiday) rowBg = 'bg-yellow-50';

                                    const isUserLeave = localUserLeaves && localUserLeaves.includes(iso);
                                    const pastOrToday = isPastOrToday(d);
                                    // determine today / past / future
                                    const tDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                    const todayDate = new Date();
                                    todayDate.setHours(0, 0, 0, 0);
                                    const isToday = tDate.getTime() === todayDate.getTime();
                                    const isPastOnly = tDate.getTime() < todayDate.getTime();
                                    if (isToday) rowBg = 'bg-green-100';
                                    // show time only when NOT marked as leave, and when it's past/today or a non-immediate application for future
                                    const showTime = !isUserLeave && (pastOrToday || (!immediate && !pastOrToday));

                                    // build a responsive row: left=date(+mobile info), center=desktop info (badge/time), right=actions
                                    const sd = shiftDetailsMap[iso];
                                    const timeStr =
                                        sd && sd.start_time && sd.end_time
                                            ? `${formatTimeShort(sd.start_time.slice(0, 5))}〜${formatTimeShort(sd.end_time.slice(0, 5))}`
                                            : sd
                                              ? '時間未設定'
                                              : null;
                                    return (
                                        <div key={iso} className={`flex items-center justify-between border-b px-4 py-2 ${rowBg}`}>
                                            <div className="flex flex-1 items-center gap-4 md:flex-none">
                                                <div>
                                                    <div className="font-medium">{formatMd(d)}</div>
                                                    <div className="mt-1 md:hidden">
                                                        {holiday && <div className="text-xs text-red-600">祝日</div>}
                                                    </div>
                                                </div>

                                                {/* desktop: inline badge/time next to date */}
                                                <div className="hidden items-center gap-3 md:flex">
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
                                                <div className="md:hidden">
                                                    {isUserLeave && (
                                                        <div className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                            休
                                                        </div>
                                                    )}
                                                    {showTime && timeStr && (
                                                        <div
                                                            className={`mt-1 text-xs ${isPastOnly ? 'text-muted-foreground' : 'font-medium text-sky-700'}`}
                                                        >
                                                            {timeStr}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {pastOrToday ? null : isUserLeave ? (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={async () => {
                                                            try {
                                                                await axios.post(route('shifts.unmark_break'), { user_id: authUser.id, date: iso });
                                                                setLocalUserLeaves((prev) => prev.filter((x) => x !== iso));
                                                                setToast({ message: '休暇をキャンセルしました。', type: 'success' });
                                                            } catch (e) {
                                                                console.error(e);
                                                                setToast({ message: '休暇のキャンセルに失敗しました。', type: 'error' });
                                                            }
                                                        }}
                                                    >
                                                        キャンセル
                                                    </Button>
                                                ) : immediate ? (
                                                    <Button size="sm" onClick={() => postImmediateLeave(iso)}>
                                                        休暇登録
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                                                        onClick={() => {
                                                            setModalDate(iso);
                                                            setModalOpen(true);
                                                        }}
                                                    >
                                                        休暇申請
                                                    </Button>
                                                )}
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
