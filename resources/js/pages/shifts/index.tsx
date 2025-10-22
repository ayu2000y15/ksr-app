import HeadingSmall from '@/components/heading-small';
import MonthEditor from '@/components/shifts/month-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem, PageProps, PaginatedResponse } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { LoaderCircle, Trash } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';

type DefaultShiftType = {
    id: number;
    name?: string;
    type?: 'weekday' | 'holiday' | string;
    day_of_week?: number | string;
    shift_type?: 'day' | 'night' | string;
    start_time?: string;
    end_time?: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'シフト管理', href: route('shifts.index') }];

const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    return (
        <Link href={route('shifts.index', { sort: sort_key, direction: newDirection })} preserveState preserveScroll>
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

export default function Index({ shifts: initialShifts, queryParams = {} }: PageProps<{ shifts: PaginatedResponse<any>; queryParams: any }>) {
    const [shifts, setShifts] = useState(() => initialShifts?.data ?? []);
    const [nextPageUrl, setNextPageUrl] = useState(() => initialShifts?.next_page_url ?? null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setShifts(initialShifts?.data ?? []);
        setNextPageUrl(initialShifts?.next_page_url ?? null);
    }, [initialShifts]);

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
                    const newItems = (page.props.shifts as PaginatedResponse<any>).data;
                    const nextPage = (page.props.shifts as PaginatedResponse<any>).next_page_url;
                    setShifts((prev) => [...prev, ...newItems]);
                    setNextPageUrl(nextPage);
                    setLoading(false);
                },
                onError: () => setLoading(false),
            },
        );
    };

    const confirmAndDelete = (shift: any) => {
        if (!confirm(`シフト「${shift.id}」を削除してもよろしいですか？この操作は取り消せません。`)) return;

        router.delete(route('shifts.destroy', shift.id), { preserveState: false });
    };

    const page = usePage();
    const { permissions } = page.props as any;
    const upcomingApplications = useMemo(() => {
        try {
            return ((page.props as any).upcomingApplications as any[]) || [];
        } catch (e) {
            return [];
        }
    }, [page.props]);
    // baseline for "today" used in upcoming filter (midnight)
    const todayStart = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    // only future leave applications
    const upcomingLeaveApplications = useMemo(() => {
        try {
            return (upcomingApplications || []).filter((a: any) => {
                if (!a) return false;
                // only show applications explicitly marked as leave
                if (a.type !== 'leave') return false;
                if (!a.date) return false;
                try {
                    return new Date(a.date) > todayStart;
                } catch (e) {
                    return false;
                }
            });
        } catch (e) {
            return [];
        }
    }, [upcomingApplications, todayStart]);
    const queryDate = (page.props as any).queryParams?.date ?? null;

    const timelineShiftDetails = useMemo(() => {
        const all = (page.props as any).shiftDetails || [];
        if (!queryDate) return [];
        return all.filter((sd: any) => {
            try {
                // prefer start_time so shifts that span multiple dates appear only on their start date
                const d = sd.start_time ? sd.start_time : sd.date;
                return d && String(d).startsWith(queryDate);
            } catch (e) {
                return false;
            }
        });
    }, [page.props, (page.props as any).shiftDetails, queryDate]);

    // when queryDate appears in props, navigate to the separate daily page
    useEffect(() => {
        if (queryDate) {
            // navigate to shifts.index with date param (avoid using a non-registered Ziggy route)
            router.get(route('shifts.daily'), { date: queryDate }, { preserveState: true, only: ['shiftDetails', 'queryParams'] });
        }
    }, [queryDate]);

    // prefer server-provided ordering (server returns users ordered by position)
    const usersById = useMemo(() => {
        const u = (page.props as any).users || [];
        return Array.isArray(u) ? u.slice() : [];
    }, [(page.props as any).users]);

    const serverDefaultShifts: DefaultShiftType[] = ((page.props as any).defaultShifts as DefaultShiftType[]) || [];

    // selectedAccent removed: calendar color selector not needed per request

    // prefer server-provided existingShifts (built in ShiftController), fallback to client build
    const serverExisting = (page.props as any).existingShifts ?? null;
    // serverExisting may have numeric keys that serialize as strings when sent over JSON; keep flexible typing
    const existingShiftsMap = (serverExisting || {}) as Record<number | string, Record<string, string>>;

    const canView = permissions?.shift?.view || permissions?.is_system_admin;
    const canCreate = permissions?.shift?.create || permissions?.is_system_admin;
    const canUpdate = permissions?.shift?.update || permissions?.is_system_admin;
    const canDelete = permissions?.shift?.delete || permissions?.is_system_admin;

    // modal / edit state for shift detail editing
    const [modalOpen, setModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<any | null>(null);
    const [editStart, setEditStart] = useState(''); // datetime-local value: yyyy-MM-ddTHH:mm
    const [editEnd, setEditEnd] = useState('');
    const [localShiftDetails, setLocalShiftDetails] = useState<any[]>(() => (page.props as any).shiftDetails || []);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const toServerDateTime = (dtLocal: string) => {
        // convert 'yyyy-MM-ddTHH:mm' -> 'yyyy-MM-dd HH:mm:00'
        if (!dtLocal) return null;
        return dtLocal.replace('T', ' ') + ':00';
    };

    const formatDateTimeLocal = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const Y = d.getFullYear();
        const M = pad(d.getMonth() + 1);
        const D = pad(d.getDate());
        const h = pad(d.getHours());
        const m = pad(d.getMinutes());
        return `${Y}-${M}-${D}T${h}:${m}`;
    };

    const saveShiftDetail = async () => {
        if (!editingShift) return;
        const payload = {
            start_time: toServerDateTime(editStart),
            end_time: toServerDateTime(editEnd),
        };
        try {
            await axios.patch(route('shift-details.update', editingShift.id), payload);
            setModalOpen(false);
            setEditingShift(null);
            // refresh only the props we need
            const month = (page.props as any).queryParams?.month ?? null;
            router.get(
                route('shifts.index'),
                { month },
                { preserveState: true, only: ['shiftDetails', 'existingShifts', 'holidays', 'users', 'queryParams', 'defaultShifts'] },
            );
        } catch (err) {
            // simple fallback: close modal
            setModalOpen(false);
        }
    };

    // keep a local copy of shiftDetails so we can update UI optimistically without full page reload
    useEffect(() => {
        setLocalShiftDetails(queryDate ? timelineShiftDetails : (page.props as any).shiftDetails || []);
    }, [page.props, timelineShiftDetails, queryDate]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="シフト管理" />

            <div className="p-4 sm:p-6 lg:p-8">
                {/* Upcoming leave applications (future only) */}
                {upcomingLeaveApplications.length > 0 && (
                    <div className="mb-6">
                        <div className="mb-2 text-sm font-medium">休暇申請一覧（今後）</div>
                        <div className="rounded-md border border-sky-100 bg-sky-50 p-3">
                            <ul className="space-y-2">
                                {upcomingLeaveApplications.map((a: any) => (
                                    <li key={a.id} className="flex items-center gap-4 border-b border-sky-100 py-2 last:border-b-0">
                                        <div className="flex-1 font-medium">{a.user ? a.user.name : '—'}</div>
                                        <div className="flex-1 text-sm">
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
                                        </div>
                                        <div className="flex-1 text-sm break-words whitespace-pre-line text-muted-foreground">{a.reason || '—'}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
                {/* 今日のシフトボタンとユーザー統計ボタン */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => {
                                // navigate to today's timeline (日間表示)
                                try {
                                    const now = new Date();
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    const y = now.getFullYear();
                                    const m = pad(now.getMonth() + 1);
                                    const d = pad(now.getDate());
                                    const iso = `${y}-${m}-${d}`;
                                    router.get(route('shifts.daily'), { date: iso }, { preserveState: true, only: ['shiftDetails', 'queryParams'] });
                                } catch (e) {
                                    // noop
                                }
                            }}
                        >
                            今日のシフト
                        </Button>
                    </div>

                    <div>
                        <Button
                            aria-label="ユーザー別統計"
                            variant="outline"
                            onClick={() => {
                                try {
                                    router.get(route('shifts.user-stats'));
                                } catch (e) {
                                    // noop
                                }
                            }}
                        >
                            ユーザー別統計
                        </Button>
                    </div>
                </div>
                {/* 月間エディタ（表形式） */}
                {page.props.users && (
                    <MonthEditor
                        users={usersById}
                        days={(() => {
                            const pad = (n: number) => String(n).padStart(2, '0');
                            // if server provided a month via query params (e.g. ?month=2025-08-01), use that
                            const serverMonth = (page.props as any).queryParams?.month ?? null;
                            let year: number;
                            let month: number;
                            if (serverMonth && typeof serverMonth === 'string') {
                                const parts = serverMonth.split('-').map((p: string) => parseInt(p, 10));
                                if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
                                    year = parts[0];
                                    month = parts[1] - 1; // JS month is 0-based
                                } else {
                                    const now = new Date();
                                    year = now.getFullYear();
                                    month = now.getMonth();
                                }
                            } else {
                                const now = new Date();
                                year = now.getFullYear();
                                month = now.getMonth();
                            }
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const out: string[] = [];
                            for (let d = 1; d <= daysInMonth; d++) {
                                out.push(`${year}-${pad(month + 1)}-${pad(d)}`);
                            }
                            return out;
                        })()}
                        holidays={(page.props as any).holidays || []}
                        existingShifts={existingShiftsMap as any}
                        shiftDetails={(page.props as any).shiftDetails || []}
                        defaultShifts={serverDefaultShifts}
                        onMonthChange={async (monthIso: string) => {
                            // request only the props we need to update the editor and list
                            // include defaultShifts so month editor can decide which day/night options to show
                            router.get(
                                route('shifts.index'),
                                { month: monthIso },
                                {
                                    preserveState: true,
                                    only: ['existingShifts', 'shiftDetails', 'holidays', 'users', 'queryParams', 'defaultShifts'],
                                },
                            );
                        }}
                    />
                )}

                {/* カレンダー表示を削除：月間エディタと一覧のみ表示 */}

                <div className="my-6">
                    <HeadingSmall title="シフト管理" description="シフトの一覧・編集・削除を行う。" />
                </div>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>シフト一覧</CardTitle>
                        {/* {canCreate && (
                            <Link href={route('shifts.create')}>
                                <Button>
                                    <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">シフトを追加</span>
                                </Button>
                            </Link>
                        )} */}
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>日付</TableHead>
                                    <TableHead>ユーザー</TableHead>
                                    <TableHead>時間</TableHead>
                                    <TableHead>昼/夜</TableHead>
                                    <TableHead className="text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/** render sorted shiftDetails by date then start_time */}
                                {useMemo(() => {
                                    // if we're viewing a specific date (daily timeline), only render timelineShiftDetails
                                    const raw = (queryDate ? timelineShiftDetails || [] : localShiftDetails || []).slice();
                                    raw.sort((a: any, b: any) => {
                                        // compare by date (YYYY-MM-DD from either explicit date or start_time)
                                        const aDate = String(a.date ?? a.start_time ?? '').slice(0, 10);
                                        const bDate = String(b.date ?? b.start_time ?? '').slice(0, 10);
                                        if (aDate !== bDate) return aDate < bDate ? -1 : 1;

                                        // same date: prefer user.position, then user_id, then user.id (ascending)
                                        const aKey = Number(a.user?.position ?? a.user_id ?? (a.user && a.user.id) ?? 0);
                                        const bKey = Number(b.user?.position ?? b.user_id ?? (b.user && b.user.id) ?? 0);
                                        if (aKey !== bKey) return aKey - bKey;

                                        // final tiebreaker: start_time (string compare of wall-clock)
                                        const aStart = String(a.start_time ?? '');
                                        const bStart = String(b.start_time ?? '');
                                        if (aStart < bStart) return -1;
                                        if (aStart > bStart) return 1;
                                        return 0;
                                    });
                                    return raw.map((sd: any) => (
                                        <TableRow
                                            key={sd.id}
                                            className="hover:bg-gray-50"
                                            onClick={() => {
                                                const s = sd.start_time ? new Date(sd.start_time) : null;
                                                const e = sd.end_time ? new Date(sd.end_time) : null;
                                                setEditingShift(sd);
                                                setEditStart(s ? formatDateTimeLocal(s) : '');
                                                setEditEnd(e ? formatDateTimeLocal(e) : '');
                                                setModalOpen(true);
                                            }}
                                        >
                                            <TableCell>
                                                {(() => {
                                                    try {
                                                        const s = sd.start_time ? new Date(sd.start_time) : new Date(sd.date ?? Date.now());
                                                        const m = s.getMonth() + 1;
                                                        const d = s.getDate();
                                                        const jp = ['日', '月', '火', '水', '木', '金', '土'];
                                                        const w = jp[s.getDay()];
                                                        return `${m}/${d} (${w})`;
                                                    } catch (e) {
                                                        return '—';
                                                    }
                                                })()}
                                            </TableCell>

                                            <TableCell>
                                                {sd.user ? (
                                                    <>
                                                        <span className="mr-2 inline-block w-10 text-right font-mono tabular-nums">
                                                            {sd.user.position ?? sd.user.id}
                                                        </span>
                                                        <span>{sd.user.name}</span>
                                                    </>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                {(() => {
                                                    try {
                                                        const s = new Date(sd.start_time);
                                                        const e = new Date(sd.end_time);
                                                        const pad = (n: number) => String(n).padStart(2, '0');
                                                        const sh = String(s.getHours());
                                                        const sm = pad(s.getMinutes());
                                                        const eh = String(e.getHours());
                                                        const em = pad(e.getMinutes());
                                                        const d = sd.date ? new Date(sd.date) : s;
                                                        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        const isPast = day.getTime() < today.getTime();
                                                        const timeStr = `${sh}:${sm}〜${eh}:${em}`;
                                                        return (
                                                            <span className={isPast ? 'text-muted-foreground' : 'font-medium text-sky-700'}>
                                                                {timeStr}
                                                            </span>
                                                        );
                                                    } catch (e) {
                                                        return '—';
                                                    }
                                                })()}
                                            </TableCell>

                                            <TableCell>
                                                {(() => {
                                                    try {
                                                        const d = new Date(sd.date ?? sd.start_time);
                                                        const y = d.getFullYear();
                                                        const m = String(d.getMonth() + 1).padStart(2, '0');
                                                        const dd = String(d.getDate()).padStart(2, '0');
                                                        const dateKey = `${y}-${m}-${dd}`;
                                                        const st = (existingShiftsMap as any)?.[sd.user_id]?.[dateKey];
                                                        if (st === 'day') return <Badge className="bg-yellow-100 text-yellow-800">昼</Badge>;
                                                        if (st === 'night') return <Badge className="bg-blue-100 text-blue-800">夜</Badge>;
                                                        return <Badge variant="outline">—</Badge>;
                                                    } catch (e) {
                                                        return <Badge variant="outline">—</Badge>;
                                                    }
                                                })()}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                {canDelete && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={async (ev) => {
                                                            ev.stopPropagation();
                                                            if (!confirm('この勤務詳細を削除しますか？')) return;
                                                            try {
                                                                await axios.delete(route('shift-details.destroy', sd.id));
                                                                // optimistic UI: remove from local list and show toast
                                                                setLocalShiftDetails((prev) => prev.filter((x) => x.id !== sd.id));
                                                                setToast({ message: '勤務詳細を削除しました。', type: 'success' });
                                                            } catch (err) {
                                                                console.error(err);
                                                                setToast({ message: '勤務詳細の削除に失敗しました。', type: 'error' });
                                                            }
                                                        }}
                                                    >
                                                        <Trash className="mr-2 h-4 w-4" /> 削除
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ));
                                }, [localShiftDetails, timelineShiftDetails, queryDate])}
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
                    </CardContent>
                </Card>

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Edit modal for shift detail */}
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>勤務詳細の編集</DialogTitle>
                        </DialogHeader>
                        <div id="shift-detail-edit-desc" className="sr-only">
                            開始・終了日時を編集して勤務詳細を更新します。
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <Label>開始日時</Label>
                                <Input type="datetime-local" value={editStart} onChange={(e: any) => setEditStart(e.target.value)} />
                            </div>
                            <div>
                                <Label>終了日時</Label>
                                <Input type="datetime-local" value={editEnd} onChange={(e: any) => setEditEnd(e.target.value)} />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setModalOpen(false);
                                    setEditingShift(null);
                                }}
                            >
                                キャンセル
                            </Button>
                            <Button onClick={() => saveShiftDetail()}>保存</Button>
                        </div>
                    </DialogContent>
                </Dialog>
                {/* queryDate が来たら別ページに遷移する（モーダルではなく） */}
                {/** リダイレクトは副作用で行う */}
            </div>
        </AppSidebarLayout>
    );
}
