import HeadingSmall from '@/components/heading-small';
import MonthEditor from '@/components/shifts/month-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem, PageProps, PaginatedResponse } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, Trash } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: 'シフト管理', href: route('shifts.index') },
];

const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    const Icon = isCurrentSort ? (currentDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
        <Link
            href={route('shifts.index', { sort: sort_key, direction: newDirection })}
            preserveState
            preserveScroll
            className="flex items-center gap-2"
        >
            {children}
            <Icon className={`h-4 w-4 ${isCurrentSort ? 'text-primary' : 'text-muted-foreground'}`} />
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
    const upcomingApplications = (page.props as any).upcomingApplications || [];
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
            router.get(route('shifts.index'), { date: queryDate }, { preserveState: true, only: ['shiftDetails', 'queryParams'] });
        }
    }, [queryDate]);

    // ensure users are displayed in ID order in the month editor
    const usersById = useMemo(() => {
        const u = (page.props as any).users || [];
        try {
            return (Array.isArray(u) ? u.slice() : []).sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0));
        } catch (e) {
            return u;
        }
    }, [(page.props as any).users]);

    const [selectedAccent, setSelectedAccent] = useState<string>('');

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
                { preserveState: true, only: ['shiftDetails', 'existingShifts', 'holidays', 'users', 'queryParams'] },
            );
        } catch (err) {
            // simple fallback: close modal
            setModalOpen(false);
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="シフト管理" />

            <div className="p-4 sm:p-6 lg:p-8">
                {/* Upcoming leave applications (future only) */}
                {upcomingApplications.length > 0 && (
                    <div className="mb-6">
                        <div className="mb-2 text-sm font-medium">休暇申請一覧（今後）</div>
                        <div className="rounded-md border border-sky-100 bg-sky-50 p-3">
                            <ul className="space-y-2">
                                {upcomingApplications
                                    .filter((a: any) => new Date(a.date) > new Date(new Date().setHours(0, 0, 0, 0)))
                                    .map((a: any) => (
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
                                            <div className="flex-1 text-sm break-words whitespace-pre-line text-muted-foreground">
                                                {a.reason || '—'}
                                            </div>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    </div>
                )}
                {/* Accent color selector for calendar display */}
                <div className="mb-4 flex items-center gap-3">
                    <label className="text-sm">カレンダー表示色：</label>
                    <select
                        value={selectedAccent}
                        onChange={(e) => setSelectedAccent(e.target.value)}
                        className="rounded border p-1 text-sm"
                        aria-label="カレンダー表示色の選択"
                    >
                        <option value="">デフォルト</option>
                        <option value="bg-green-50">薄い緑</option>
                        <option value="bg-sky-50">薄い水色</option>
                        <option value="bg-yellow-50">薄い黄</option>
                        <option value="bg-blue-50">薄い青</option>
                    </select>
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
                        accentClass={selectedAccent}
                        onMonthChange={async (monthIso: string) => {
                            // request only the props we need to update the editor and list
                            router.get(
                                route('shifts.index'),
                                { month: monthIso },
                                { preserveState: true, only: ['existingShifts', 'shiftDetails', 'holidays', 'users', 'queryParams'] },
                            );
                        }}
                    />
                )}

                {/* カレンダー表示を削除：月間エディタと一覧のみ表示 */}

                <div className="my-6">
                    <HeadingSmall title="シフト管理" description="シフトの一覧・編集・削除を行う。" />
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
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
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/** render sorted shiftDetails by date then start_time */}
                                {useMemo(() => {
                                    // if we're viewing a specific date (daily timeline), only render timelineShiftDetails
                                    const raw = (queryDate ? timelineShiftDetails || [] : (page.props as any).shiftDetails || []).slice();
                                    raw.sort((a: any, b: any) => {
                                        // compare by date (YYYY-MM-DD from either explicit date or start_time)
                                        const aDate = String(a.date ?? a.start_time ?? '').slice(0, 10);
                                        const bDate = String(b.date ?? b.start_time ?? '').slice(0, 10);
                                        if (aDate !== bDate) return aDate < bDate ? -1 : 1;

                                        // same date: sort by user_id ascending
                                        const aUid = Number(a.user_id ?? (a.user && a.user.id) ?? 0);
                                        const bUid = Number(b.user_id ?? (b.user && b.user.id) ?? 0);
                                        if (aUid !== bUid) return aUid - bUid;

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

                                            <TableCell>{sd.user ? sd.user.name : '—'}</TableCell>

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
                                                                // refresh only the props we need (same month)
                                                                const month = (page.props as any).queryParams?.month ?? null;
                                                                router.get(
                                                                    route('shifts.index'),
                                                                    { month },
                                                                    {
                                                                        preserveState: true,
                                                                        only: ['shiftDetails', 'existingShifts', 'holidays', 'users', 'queryParams'],
                                                                    },
                                                                );
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert('勤務詳細の削除に失敗しました。');
                                                            }
                                                        }}
                                                    >
                                                        <Trash className="mr-2 h-4 w-4" /> 削除
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ));
                                }, [(page.props as any).shiftDetails, timelineShiftDetails, queryDate])}
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
