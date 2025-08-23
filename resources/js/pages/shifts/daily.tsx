import BreakTimeline from '@/components/shifts/break-timeline';
import ShiftTimeline from '@/components/shifts/shift-timeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';

export default function Daily() {
    const page = usePage();
    const props = page.props as any;
    const date = props?.queryParams?.date ?? props?.date ?? null;
    const displayDate = date ? String(date).slice(0, 10).replace(/-/g, '/') : '';
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'ダッシュボード', href: route('dashboard') },
        { title: 'シフト管理', href: route('shifts.index') },
        { title: `日間タイムライン: ${displayDate}`, href: '' },
    ];
    // keep a local copy so edits can be applied without a full page reload
    const initialShiftDetails = (props?.shiftDetails || []) as unknown as any[];
    const [shiftDetails, setShiftDetails] = useState<any[]>(initialShiftDetails);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    // keep local state in sync if props change (Inertia navigation)
    useEffect(() => {
        setShiftDetails(props?.shiftDetails || []);
    }, [props?.shiftDetails]);

    // Listen for global updates so that status changes (e.g. absent) reflect immediately
    useEffect(() => {
        const handler = (e: Event) => {
            try {
                const ev = e as CustomEvent<any>;
                const d = ev && ev.detail ? ev.detail : null;
                if (!d || typeof d.id === 'undefined') return;
                const id = Number(d.id);
                const status = d.status;
                setShiftDetails((prev: any[]) => prev.map((p: any) => (Number(p.id) === id ? { ...p, status } : p)));
            } catch (err) {
                // ignore
            }
        };
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('ksr.shiftDetail.updated', handler as EventListener);
        }
        // toast listener
        const toastHandler = (e: Event) => {
            try {
                const ev = e as CustomEvent<any>;
                const d = ev && ev.detail ? ev.detail : null;
                if (!d) return;
                const msg = d.message ?? (d.status === 'absent' ? '欠席にしました' : '更新しました');
                setToast({ message: String(msg), type: 'success' });
            } catch {
                // ignore
            }
        };
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('ksr.shiftDetail.toast', toastHandler as EventListener);
        }
        return () => {
            if (typeof window !== 'undefined' && window.removeEventListener) {
                window.removeEventListener('ksr.shiftDetail.updated', handler as EventListener);
                window.removeEventListener('ksr.shiftDetail.toast', toastHandler as EventListener);
            }
        };
    }, []);

    const [mode, setMode] = useState<'shift' | 'break'>('shift');
    const [breakType, setBreakType] = useState<'planned' | 'actual'>('planned');
    const [breakLocked, setBreakLocked] = useState<boolean>(true);

    // persist selected tab and break type across page reloads
    useEffect(() => {
        try {
            const savedMode = typeof window !== 'undefined' ? localStorage.getItem('daily.mode') : null;
            if (savedMode === 'shift' || savedMode === 'break') {
                setMode(savedMode as 'shift' | 'break');
            }
            const savedBreakType = typeof window !== 'undefined' ? localStorage.getItem('daily.breakType') : null;
            if (savedBreakType === 'planned' || savedBreakType === 'actual') {
                setBreakType(savedBreakType as 'planned' | 'actual');
            }
            const savedLocked = typeof window !== 'undefined' ? localStorage.getItem('daily.breakLocked') : null;
            if (savedLocked === '0' || savedLocked === '1') {
                setBreakLocked(savedLocked === '1');
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') localStorage.setItem('daily.mode', mode);
        } catch {
            // ignore
        }
    }, [mode]);

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') localStorage.setItem('daily.breakType', breakType);
        } catch {
            // ignore
        }
    }, [breakType]);

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') localStorage.setItem('daily.breakLocked', breakLocked ? '1' : '0');
        } catch {
            // ignore
        }
    }, [breakLocked]);
    const permissions = props?.permissions || {};
    const canUpdateBreak = permissions?.shift?.update || permissions?.is_system_admin;
    const canDeleteBreak = permissions?.shift?.delete || permissions?.is_system_admin;

    const [editingBreakId, setEditingBreakId] = useState<number | null>(null);
    const [editStartVal, setEditStartVal] = useState<string>('');
    const [editEndVal, setEditEndVal] = useState<string>('');
    const [editStatus, setEditStatus] = useState<'scheduled' | 'actual' | 'absent'>('scheduled');
    // break list sorting state
    const [breakSortBy, setBreakSortBy] = useState<'user' | 'time' | 'status'>('user');
    const [breakSortDir, setBreakSortDir] = useState<'asc' | 'desc'>('asc');

    const handleCreateBreak = async (payload: {
        shift_detail_id: number;
        start_time: string;
        end_time: string;
        type?: string;
        user_id?: number;
        date?: string;
    }) => {
        // determine user_id and date for creating ShiftDetail if not provided
        const body = {
            user_id: payload.user_id || null,
            date: payload.date || date,
            start_time: payload.start_time,
            end_time: payload.end_time,
            type: 'break',
            // reflect the selected 種別: 'actual' -> actual, otherwise scheduled
            status: payload.type === 'actual' ? 'actual' : 'scheduled',
            shift_detail_id: payload.shift_detail_id,
        } as any;

        // If no user_id available, try to derive from shiftDetails map
        if (!body.user_id && payload.shift_detail_id) {
            const found = shiftDetails.find((s) => s.id === payload.shift_detail_id);
            if (found) body.user_id = found.user_id ?? (found.user && found.user.id);
            if (!body.date) body.date = found ? found.date : body.date;
        }

        // If the selected range exactly matches an existing break of the same user and same status,
        // toggle-delete it instead of creating a new one.
        try {
            if (body.user_id) {
                const existing = shiftDetails.find(
                    (s) =>
                        String(s.type ?? '') === 'break' &&
                        String(s.user_id ?? '') === String(body.user_id) &&
                        (s.start_time ?? '') === (body.start_time ?? '') &&
                        (s.end_time ?? '') === (body.end_time ?? '') &&
                        (s.status ?? 'scheduled') === (body.status ?? 'scheduled'),
                );

                if (existing) {
                    // If locked, prevent deletion via toggle
                    if (breakLocked) {
                        setToast({ message: '休憩はロックされています。ロックを解除してください。', type: 'error' });
                        return;
                    }

                    // If user lacks delete permission, show message and abort
                    if (!canDeleteBreak) {
                        setToast({ message: '休憩を削除する権限がありません', type: 'error' });
                        return;
                    }

                    // perform delete (toggle behavior)
                    try {
                        await axios.delete(route('shift-details.destroy', existing.id));
                        setShiftDetails((prev) => prev.filter((p) => p.id !== existing.id));
                        setToast({ message: `${body.status === 'actual' ? '実績' : '予定'}休憩を削除しました`, type: 'success' });
                        return;
                    } catch (e: any) {
                        console.error('failed to delete matched break', e);
                        setToast({ message: '休憩の削除に失敗しました', type: 'error' });
                        return;
                    }
                }
            }
        } catch (e) {
            // fallback - continue to create
        }

        try {
            if (breakLocked) {
                setToast({ message: '休憩はロックされています。ロックを解除してください。', type: 'error' });
                return;
            }

            const res = await axios.post(route('shift-details.store'), body);
            const created = res && res.data && (res.data.shiftDetail || res.data.shift_detail) ? res.data.shiftDetail || res.data.shift_detail : null;
            if (created) {
                // add server-created break to local shiftDetails so UI updates immediately
                setShiftDetails((prev) => [...prev, created]);
            }
            setToast({ message: `${payload.type === 'actual' ? '休憩（実績）' : '休憩（予定）'} を登録しました`, type: 'success' });
            try {
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(
                        new CustomEvent('ksr.shiftDetail.updated', {
                            detail: { id: created ? created.id : null, status: created ? ((created as any).status ?? null) : null },
                        }),
                    );
                }
            } catch {
                // ignore
            }
        } catch (e: any) {
            console.error('failed to create break', e);
            // try to show server-provided validation message (e.g. 重複エラー)
            const msg =
                e &&
                e.response &&
                (e.response.data?.message || (e.response.data?.errors && e.response.data.errors.start_time && e.response.data.errors.start_time[0]))
                    ? e.response.data.message || e.response.data.errors.start_time[0]
                    : '休憩の登録に失敗しました';
            setToast({ message: msg, type: 'error' });
        }
    };

    const promptToUnlock = () => {
        if (!breakLocked) return true;
        console.log('[debug] promptToUnlock called; breakLocked=', breakLocked);
        // show a quick toast so the user sees feedback even if browser blocks confirm()
        setToast({ message: '休憩はロックされています。ロック解除の確認を表示します...', type: 'info' });
        if (confirm('休憩は現在ロックされています。ロックを解除して編集しますか？')) {
            setBreakLocked(false);
            setToast({ message: 'ロックを解除しました。編集できます。', type: 'info' });
            return true;
        }
        setToast({ message: '操作はキャンセルされました（ロック中）', type: 'info' });
        return false;
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={`日間タイムライン ${displayDate || ''}`} />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            className={`rounded px-3 py-1 text-sm ${mode === 'shift' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
                            onClick={() => setMode('shift')}
                        >
                            出勤編集
                        </button>
                        <button
                            className={`rounded px-3 py-1 text-sm ${mode === 'break' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
                            onClick={() => setMode('break')}
                        >
                            休憩登録
                        </button>
                    </div>
                    {mode === 'break' && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm">種別:</label>
                            <select value={breakType} onChange={(e) => setBreakType(e.target.value as any)} className="rounded border p-1 text-sm">
                                <option value="planned">予定</option>
                                <option value="actual">実績</option>
                            </select>
                            <button
                                className={`rounded px-2 py-1 text-sm ${breakLocked ? 'bg-gray-200 text-gray-700' : 'bg-green-600 text-white'}`}
                                title={
                                    breakLocked ? '休憩はロックされています。クリックで解除します。' : '休憩は編集可能です。クリックでロックします。'
                                }
                                onClick={() => setBreakLocked((s) => !s)}
                            >
                                {breakLocked ? (
                                    <span className="inline-flex items-center">
                                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                            <path
                                                d="M7 11V8a5 5 0 0110 0v3"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                fill="none"
                                            />
                                        </svg>
                                        <span>ロック中</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center">
                                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                            <path
                                                d="M16 11V8a4 4 0 00-8 0"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                fill="none"
                                            />
                                            <path
                                                d="M9 16h6"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                fill="none"
                                            />
                                        </svg>
                                        <span>編集可</span>
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Informational banner shown when in break mode */}
                {mode === 'break' && (
                    <div className="mb-4 flex justify-center">
                        <div
                            role="status"
                            className={`rounded px-4 py-2 text-sm font-medium ${
                                breakType === 'actual' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}
                        >
                            休憩編集モード: {breakType === 'actual' ? '実績' : '予定'}
                        </div>
                    </div>
                )}

                {mode === 'shift' ? (
                    <ShiftTimeline
                        date={date}
                        shiftDetails={shiftDetails}
                        initialInterval={30}
                        breaks={(shiftDetails || []).filter((s: any) => (s.type ?? '') === 'break')}
                        onCreateBreak={handleCreateBreak}
                        onBarClick={(id: number) => {
                            setShiftDetails((prev) => prev.map((p) => (p.id === id ? { ...p, _openEdit: true } : { ...p, _openEdit: false })));
                            setTimeout(() => {
                                const el = document.getElementById(`sd-row-${id}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 120);
                        }}
                    />
                ) : (
                    <BreakTimeline
                        date={date}
                        shiftDetails={shiftDetails}
                        initialInterval={15}
                        breakType={breakType}
                        locked={breakLocked}
                        onRequireUnlock={promptToUnlock}
                        onCreateBreak={handleCreateBreak}
                        breaks={(shiftDetails || []).filter((s: any) => (s.type ?? '') === 'break')}
                        canDeleteBreak={canDeleteBreak}
                        onDeleteBreak={(id: number) => {
                            setShiftDetails((prev) => prev.filter((p) => p.id !== id));
                            setToast({ message: '削除しました', type: 'success' });
                        }}
                    />
                )}

                {/* editable list below the timeline (same design as シフト一覧) */}
                <div className="mt-6">
                    {mode === 'shift' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>シフト一覧</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ユーザー</TableHead>
                                            <TableHead>時間</TableHead>
                                            <TableHead>昼/夜</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(() => {
                                            // Filter to only the shiftDetails that start on the requested date
                                            // and only show records of type 'work' in the main shift list
                                            const filtered = (shiftDetails || [])
                                                .filter((sd: any) => (sd.type ?? '') === 'work')
                                                .filter((sd: any) => {
                                                    try {
                                                        const startDate = sd.start_time
                                                            ? String(sd.start_time).slice(0, 10)
                                                            : sd.date
                                                              ? String(sd.date).slice(0, 10)
                                                              : null;
                                                        return startDate === date;
                                                    } catch {
                                                        return false;
                                                    }
                                                });

                                            // sort by user_id (asc) then by start_time (asc) for the daily list
                                            const sorted = (filtered || []).slice().sort((a: any, b: any) => {
                                                // rank shift type: day first, others middle, night last
                                                const rank = (sd: any) => {
                                                    const t = (sd.shift_type || sd.type || '').toString();
                                                    if (t === 'day') return 0;
                                                    if (t === 'night') return 2;
                                                    return 1;
                                                };
                                                const ra = rank(a);
                                                const rb = rank(b);
                                                if (ra !== rb) return ra - rb;

                                                const aUid = Number(a.user_id ?? (a.user && a.user.id) ?? 0);
                                                const bUid = Number(b.user_id ?? (b.user && b.user.id) ?? 0);
                                                if (aUid !== bUid) return aUid - bUid;

                                                const aStart = String(a.start_time ?? a.startRaw ?? '');
                                                const bStart = String(b.start_time ?? b.startRaw ?? '');
                                                if (aStart < bStart) return -1;
                                                if (aStart > bStart) return 1;
                                                return 0;
                                            });
                                            return (
                                                <>
                                                    {sorted.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                                この日の勤務詳細はありません。
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    {sorted.map((sd: any) => (
                                                        <EditableShiftRow
                                                            key={sd.id}
                                                            sd={sd}
                                                            onSaved={(updated: any) => {
                                                                // prefer the client-sent datetime strings to avoid ISO/UTC transient display
                                                                setShiftDetails((prev) =>
                                                                    prev.map((p) =>
                                                                        p.id === updated.id ? { ...p, ...updated, _openEdit: false } : p,
                                                                    ),
                                                                );
                                                                // show success toast
                                                                setToast({ message: '保存しました', type: 'success' });
                                                                // notify other components (e.g., BreakTimeline) so they can update immediately
                                                                try {
                                                                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                                                                        window.dispatchEvent(
                                                                            new CustomEvent('ksr.shiftDetail.updated', {
                                                                                detail: { id: updated.id, status: (updated as any).status ?? null },
                                                                            }),
                                                                        );
                                                                    }
                                                                } catch {
                                                                    // ignore
                                                                }
                                                            }}
                                                            onDeleted={(id: number) => {
                                                                setShiftDetails((prev) => prev.filter((p) => p.id !== id));
                                                            }}
                                                            onClearOpen={(id: number) => {
                                                                setShiftDetails((prev) =>
                                                                    prev.map((p) => (p.id === id ? { ...p, _openEdit: false } : p)),
                                                                );
                                                            }}
                                                        />
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {mode === 'break' && (
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle>休憩一覧</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <button
                                                    className={`flex items-center gap-2 font-medium ${breakSortBy === 'user' ? 'text-indigo-600' : ''}`}
                                                    onClick={() => {
                                                        if (breakSortBy === 'user') setBreakSortDir(breakSortDir === 'asc' ? 'desc' : 'asc');
                                                        else {
                                                            setBreakSortBy('user');
                                                            setBreakSortDir('asc');
                                                        }
                                                    }}
                                                >
                                                    <span>ユーザー</span>
                                                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        {breakSortBy === 'user' ? (
                                                            breakSortDir === 'asc' ? (
                                                                <path
                                                                    d="M5 12l5-5 5 5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            ) : (
                                                                <path
                                                                    d="M5 8l5 5 5-5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            )
                                                        ) : (
                                                            <path
                                                                d="M5 12l5-5 5 5"
                                                                stroke="currentColor"
                                                                strokeWidth="1"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                opacity="0.4"
                                                            />
                                                        )}
                                                    </svg>
                                                </button>
                                            </TableHead>
                                            <TableHead>
                                                <button
                                                    className={`flex items-center gap-2 font-medium ${breakSortBy === 'time' ? 'text-indigo-600' : ''}`}
                                                    onClick={() => {
                                                        if (breakSortBy === 'time') setBreakSortDir(breakSortDir === 'asc' ? 'desc' : 'asc');
                                                        else {
                                                            setBreakSortBy('time');
                                                            setBreakSortDir('asc');
                                                        }
                                                    }}
                                                >
                                                    <span>時間</span>
                                                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        {breakSortBy === 'time' ? (
                                                            breakSortDir === 'asc' ? (
                                                                <path
                                                                    d="M5 12l5-5 5 5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            ) : (
                                                                <path
                                                                    d="M5 8l5 5 5-5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            )
                                                        ) : (
                                                            <path
                                                                d="M5 12l5-5 5 5"
                                                                stroke="currentColor"
                                                                strokeWidth="1"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                opacity="0.4"
                                                            />
                                                        )}
                                                    </svg>
                                                </button>
                                            </TableHead>
                                            <TableHead>
                                                <button
                                                    className={`flex items-center gap-2 font-medium ${breakSortBy === 'status' ? 'text-indigo-600' : ''}`}
                                                    onClick={() => {
                                                        if (breakSortBy === 'status') setBreakSortDir(breakSortDir === 'asc' ? 'desc' : 'asc');
                                                        else {
                                                            setBreakSortBy('status');
                                                            setBreakSortDir('asc');
                                                        }
                                                    }}
                                                >
                                                    <span>種別</span>
                                                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        {breakSortBy === 'status' ? (
                                                            breakSortDir === 'asc' ? (
                                                                <path
                                                                    d="M5 12l5-5 5 5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            ) : (
                                                                <path
                                                                    d="M5 8l5 5 5-5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            )
                                                        ) : (
                                                            <path
                                                                d="M5 12l5-5 5 5"
                                                                stroke="currentColor"
                                                                strokeWidth="1"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                opacity="0.4"
                                                            />
                                                        )}
                                                    </svg>
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(() => {
                                            // build break entries directly from shiftDetails (server source-of-truth)
                                            // Exclude breaks with status 'absent' and breaks for users whose work shift on this date is marked absent.
                                            const absentUserIds = new Set<string>();
                                            (shiftDetails || [])
                                                .filter((sd: any) => String(sd.type ?? '') === 'work')
                                                .filter((sd: any) => {
                                                    try {
                                                        const startDate = sd.start_time
                                                            ? String(sd.start_time).slice(0, 10)
                                                            : sd.date
                                                              ? String(sd.date).slice(0, 10)
                                                              : null;
                                                        return startDate === date && String(sd.status ?? '') === 'absent';
                                                    } catch {
                                                        return false;
                                                    }
                                                })
                                                .forEach((w: any) => {
                                                    const uid = w.user_id ?? (w.user && w.user.id) ?? null;
                                                    if (uid !== null && typeof uid !== 'undefined') absentUserIds.add(String(uid));
                                                });

                                            const sdBreaks = (shiftDetails || []).filter((s: any) => {
                                                // skip non-breaks
                                                if (String(s.type ?? '') !== 'break') return false;
                                                // skip breaks explicitly marked absent
                                                if (String(s.status ?? '') === 'absent') return false;
                                                // skip breaks belonging to users who are absent for the date
                                                const uid = s.user_id ?? (s.user && s.user.id) ?? null;
                                                if (uid !== null && typeof uid !== 'undefined' && absentUserIds.has(String(uid))) return false;
                                                return true;
                                            });

                                            // Determine the user ordering used by the timeline (work items on the date)
                                            const workItems = (shiftDetails || [])
                                                .filter((sd: any) => (sd.type ?? '') === 'work')
                                                .filter((sd: any) => {
                                                    try {
                                                        const startDate = sd.start_time
                                                            ? String(sd.start_time).slice(0, 10)
                                                            : sd.date
                                                              ? String(sd.date).slice(0, 10)
                                                              : null;
                                                        return startDate === date;
                                                    } catch {
                                                        return false;
                                                    }
                                                })
                                                .slice()
                                                .sort((a: any, b: any) => {
                                                    const rank = (sd: any) => {
                                                        const t = (sd.shift_type || sd.type || '').toString();
                                                        if (t === 'day') return 0;
                                                        if (t === 'night') return 2;
                                                        return 1;
                                                    };
                                                    const ra = rank(a);
                                                    const rb = rank(b);
                                                    if (ra !== rb) return ra - rb;
                                                    const aUid = Number(a.user_id ?? (a.user && a.user.id) ?? 0);
                                                    const bUid = Number(b.user_id ?? (b.user && b.user.id) ?? 0);
                                                    if (aUid !== bUid) return aUid - bUid;
                                                    const aStart = String(a.start_time ?? a.startRaw ?? '');
                                                    const bStart = String(b.start_time ?? b.startRaw ?? '');
                                                    if (aStart < bStart) return -1;
                                                    if (aStart > bStart) return 1;
                                                    return 0;
                                                });

                                            // map user id to order index
                                            const userOrder: Record<string | number, number> = {};
                                            workItems.forEach((wi: any, idx: number) => {
                                                const uid = wi.user_id ?? (wi.user && wi.user.id) ?? '';
                                                if (userOrder[String(uid)] === undefined) userOrder[String(uid)] = idx;
                                            });

                                            const combined = sdBreaks
                                                .map((s: any) => ({
                                                    id: s.id,
                                                    user_id: s.user_id ?? (s.user && s.user.id) ?? '—',
                                                    start_time: s.start_time,
                                                    end_time: s.end_time,
                                                    status: s.status ?? 'scheduled',
                                                    user_name: s.user ? s.user.name : '—',
                                                }))
                                                .slice()
                                                .sort((a: any, b: any) => {
                                                    const au = userOrder[String(a.user_id)] ?? Number.MAX_SAFE_INTEGER;
                                                    const bu = userOrder[String(b.user_id)] ?? Number.MAX_SAFE_INTEGER;
                                                    if (au !== bu) return au - bu;
                                                    // same user: sort by start_time asc (nulls last)
                                                    if (!a.start_time && !b.start_time) return 0;
                                                    if (!a.start_time) return 1;
                                                    if (!b.start_time) return -1;
                                                    if (a.start_time < b.start_time) return -1;
                                                    if (a.start_time > b.start_time) return 1;
                                                    return 0;
                                                });

                                            if (combined.length === 0) {
                                                return (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                            休憩は登録されていません。
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            const statusLabel = (st?: string | null) => {
                                                if (!st) return '予定';
                                                if (st === 'actual') return '実績';
                                                if (st === 'scheduled') return '予定';
                                                if (st === 'absent') return '欠席';
                                                return String(st);
                                            };

                                            const sortedByHeader = combined.slice().sort((a: any, b: any) => {
                                                const dir = breakSortDir === 'asc' ? 1 : -1;
                                                if (breakSortBy === 'user') {
                                                    const au = String(a.user_id ?? '') || '';
                                                    const bu = String(b.user_id ?? '') || '';
                                                    if (au < bu) return -1 * dir;
                                                    if (au > bu) return 1 * dir;
                                                    return 0;
                                                }
                                                if (breakSortBy === 'time') {
                                                    const at = a.start_time ?? '';
                                                    const bt = b.start_time ?? '';
                                                    if (!at && !bt) return 0;
                                                    if (!at) return 1 * dir;
                                                    if (!bt) return -1 * dir;
                                                    if (at < bt) return -1 * dir;
                                                    if (at > bt) return 1 * dir;
                                                    return 0;
                                                }
                                                // status
                                                const ast = a.status ?? 'scheduled';
                                                const bst = b.status ?? 'scheduled';
                                                if (ast < bst) return -1 * dir;
                                                if (ast > bst) return 1 * dir;
                                                return 0;
                                            });

                                            return sortedByHeader.map((b) => {
                                                const isEditing = editingBreakId === b.id;
                                                return (
                                                    <TableRow key={b.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-10 text-right font-mono text-sm">{b.user_id ?? '—'}</span>
                                                                <span className="truncate">{b.user_name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="time"
                                                                        className="rounded border p-1 text-sm"
                                                                        value={editStartVal}
                                                                        onChange={(e) => setEditStartVal(e.target.value)}
                                                                    />
                                                                    <span>〜</span>
                                                                    <input
                                                                        type="time"
                                                                        className="rounded border p-1 text-sm"
                                                                        value={editEndVal}
                                                                        onChange={(e) => setEditEndVal(e.target.value)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                (timeValueFromRaw(b.start_time) || '—') + '〜' + (timeValueFromRaw(b.end_time) || '—')
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <select
                                                                    value={editStatus}
                                                                    onChange={(e) => setEditStatus(e.target.value as any)}
                                                                    className="rounded border p-1 text-sm"
                                                                >
                                                                    <option value="scheduled">予定</option>
                                                                    <option value="actual">実績</option>
                                                                    <option value="absent">欠席</option>
                                                                </select>
                                                            ) : (
                                                                statusLabel(b.status)
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {isEditing ? (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setEditingBreakId(null);
                                                                        }}
                                                                    >
                                                                        キャンセル
                                                                    </Button>
                                                                    <Button
                                                                        onClick={async () => {
                                                                            // save changes
                                                                            try {
                                                                                const sd = shiftDetails.find((s: any) => s.id === b.id) as any;
                                                                                const baseDate = sd
                                                                                    ? (sd.date ??
                                                                                      (sd.start_time ? String(sd.start_time).slice(0, 10) : date))
                                                                                    : date;
                                                                                let addDays = 0;
                                                                                if (editStartVal && editEndVal) {
                                                                                    const [sh, sm] = editStartVal.split(':').map((v) => Number(v));
                                                                                    const [eh, em] = editEndVal.split(':').map((v) => Number(v));
                                                                                    if (eh < sh || (eh === sh && em <= sm)) addDays = 1;
                                                                                }
                                                                                const sdt = toServerDateTimeFromDateAndTime(
                                                                                    baseDate,
                                                                                    editStartVal,
                                                                                    0,
                                                                                );
                                                                                const edt = toServerDateTimeFromDateAndTime(
                                                                                    baseDate,
                                                                                    editEndVal,
                                                                                    addDays,
                                                                                );
                                                                                const payload: any = {
                                                                                    start_time: sdt,
                                                                                    end_time: edt,
                                                                                    status: editStatus,
                                                                                };
                                                                                const res = await axios.patch(
                                                                                    route('shift-details.update', b.id),
                                                                                    payload,
                                                                                );
                                                                                const returned =
                                                                                    res && res.data && (res.data.shiftDetail || res.data.shift_detail)
                                                                                        ? res.data.shiftDetail || res.data.shift_detail
                                                                                        : null;
                                                                                if (returned)
                                                                                    setShiftDetails((prev) =>
                                                                                        prev.map((p) => (p.id === b.id ? { ...p, ...returned } : p)),
                                                                                    );
                                                                                setToast({ message: '保存しました', type: 'success' });
                                                                                setEditingBreakId(null);
                                                                                try {
                                                                                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                                                                                        const statusVal = returned
                                                                                            ? ((returned as any).status ?? null)
                                                                                            : ((payload as any).status ?? null);
                                                                                        window.dispatchEvent(
                                                                                            new CustomEvent('ksr.shiftDetail.updated', {
                                                                                                detail: { id: b.id, status: statusVal },
                                                                                            }),
                                                                                        );
                                                                                    }
                                                                                } catch {
                                                                                    // ignore
                                                                                }
                                                                            } catch (e: any) {
                                                                                console.error(e);
                                                                                // If validation overlap (422), show specific message
                                                                                if (e && e.response && e.response.status === 422) {
                                                                                    setToast({ message: '休憩時間が重複しています', type: 'error' });
                                                                                } else {
                                                                                    setToast({ message: '保存に失敗しました', type: 'error' });
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        保存
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {canUpdateBreak && (
                                                                        <Button
                                                                            variant="outline"
                                                                            onClick={() => {
                                                                                if (breakLocked && !promptToUnlock()) return;
                                                                                setEditingBreakId(b.id);
                                                                                setEditStartVal(padTimeForInput(timeValueFromRaw(b.start_time)));
                                                                                setEditEndVal(padTimeForInput(timeValueFromRaw(b.end_time)));
                                                                                setEditStatus((b.status as any) ?? 'scheduled');
                                                                            }}
                                                                        >
                                                                            編集
                                                                        </Button>
                                                                    )}
                                                                    {canDeleteBreak && (
                                                                        <Button
                                                                            variant="destructive"
                                                                            onClick={async () => {
                                                                                if (breakLocked && !promptToUnlock()) return;
                                                                                if (!confirm('この休憩を削除しますか？')) return;
                                                                                try {
                                                                                    await axios.delete(route('shift-details.destroy', b.id));
                                                                                    setShiftDetails((prev) => prev.filter((p) => p.id !== b.id));
                                                                                    setToast({ message: '削除しました', type: 'success' });
                                                                                } catch (e) {
                                                                                    console.error(e);
                                                                                    setToast({ message: '削除に失敗しました', type: 'error' });
                                                                                }
                                                                            }}
                                                                        >
                                                                            削除
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            });
                                        })()}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                </div>
            </div>
        </AppSidebarLayout>
    );
}

function timeValueFromRaw(raw?: string | null) {
    if (!raw) return '';
    const m = String(raw).match(/(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return '';
    // remove leading zero from hour for display (e.g. '09:05' -> '9:05')
    const hh = m[1].replace(/^0/, '');
    return `${hh}:${m[2]}`;
}

// pad single-digit hour to two digits for time input value (e.g. '9:05' -> '09:05')
function padTimeForInput(tv?: string | null) {
    if (!tv) return '';
    const m = String(tv).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '';
    return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function toServerDateTimeFromDateAndTime(dateIso?: string | null, timeHHMM?: string | null, addDays = 0) {
    if (!dateIso || !timeHHMM) return null;
    const d = String(dateIso).slice(0, 10);
    if (!/\d{4}-\d{2}-\d{2}/.test(d)) return null;
    if (!/^(\d{2}):(\d{2})$/.test(timeHHMM)) return null;
    if (addDays === 0) return `${d} ${timeHHMM}:00`;
    const parts = d.split('-').map((p) => parseInt(p, 10));
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    dt.setDate(dt.getDate() + addDays);
    const Y = dt.getFullYear();
    const M = String(dt.getMonth() + 1).padStart(2, '0');
    const DD = String(dt.getDate()).padStart(2, '0');
    return `${Y}-${M}-${DD} ${timeHHMM}:00`;
}

function formatDateLabelFromDate(rawDate?: string | null) {
    if (!rawDate) return '—';
    const d10 = String(rawDate).slice(0, 10);
    const m = d10.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return rawDate;
    const Y = Number(m[1]);
    const M = Number(m[2]);
    const D = Number(m[3]);
    const dt = new Date(Y, M - 1, D);
    const jp = ['日', '月', '火', '水', '木', '金', '土'];
    return `${M}/${D} (${jp[dt.getDay()]})`;
}

function EditableShiftRow({
    sd,
    onSaved,
    onDeleted,
    onClearOpen,
}: {
    sd: any;
    onSaved: (u: any) => void;
    onDeleted: (id: number) => void;
    onClearOpen?: (id: number) => void;
}) {
    const page = usePage();
    const props = page.props as any;
    const permissions = props?.permissions || {};
    const canUpdate = permissions?.shift?.update || permissions?.is_system_admin;
    const canDelete = permissions?.shift?.delete || permissions?.is_system_admin;

    const [editing, setEditing] = useState(false);
    const [startVal, setStartVal] = useState<string>(padTimeForInput(timeValueFromRaw(sd.start_time ?? sd.startRaw ?? null)));
    const [endVal, setEndVal] = useState<string>(padTimeForInput(timeValueFromRaw(sd.end_time ?? sd.endRaw ?? null)));
    const [saving, setSaving] = useState(false);
    const [isAbsentLocal, setIsAbsentLocal] = useState<boolean>(String(sd.status ?? '') === 'absent');

    useEffect(() => {
        setStartVal(padTimeForInput(timeValueFromRaw(sd.start_time ?? sd.startRaw ?? null)));
        setEndVal(padTimeForInput(timeValueFromRaw(sd.end_time ?? sd.endRaw ?? null)));
        // keep local absent flag in sync with prop
        setIsAbsentLocal(String(sd.status ?? '') === 'absent');
    }, [sd]);

    // listen for global updates so the row updates even if parent state hasn't propagated
    useEffect(() => {
        const handler = (e: Event) => {
            try {
                const ev = e as CustomEvent<any>;
                const d = ev && ev.detail ? ev.detail : null;
                if (!d || typeof d.id === 'undefined') return;
                const id = Number(d.id);
                if (Number(sd.id) !== id) return;
                const status = String(d.status ?? '');
                setIsAbsentLocal(status === 'absent');
            } catch {
                // ignore
            }
        };
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('ksr.shiftDetail.updated', handler as EventListener);
        }
        return () => {
            if (typeof window !== 'undefined' && window.removeEventListener) {
                window.removeEventListener('ksr.shiftDetail.updated', handler as EventListener);
            }
        };
    }, [sd.id]);

    const save = async () => {
        if (!canUpdate) return alert('権限がありません。');
        setSaving(true);
        try {
            // construct datetimes using sd.date (start date) + time values
            const sdt = toServerDateTimeFromDateAndTime(sd.date ?? sd.start_time, startVal, 0);
            let addDays = 0;
            if (endVal && startVal) {
                const [sh, sm] = startVal.split(':').map((v) => parseInt(v, 10));
                const [eh, em] = endVal.split(':').map((v) => parseInt(v, 10));
                if (eh < sh || (eh === sh && em <= sm)) addDays = 1;
            }
            const edt = toServerDateTimeFromDateAndTime(sd.date ?? sd.start_time, endVal, addDays);
            const payload = { start_time: sdt, end_time: edt };
            const res = await axios.patch(route('shift-details.update', sd.id), payload);
            // server may return an ISO-formatted datetime; to avoid transient UTC display,
            // prefer the client-sent wall-clock strings when updating local state
            const returned = res && res.data && res.data.shiftDetail ? res.data.shiftDetail : null;
            const final = returned
                ? { ...returned, start_time: payload.start_time ?? returned.start_time, end_time: payload.end_time ?? returned.end_time }
                : { id: sd.id, start_time: payload.start_time, end_time: payload.end_time };
            onSaved(final);
            setEditing(false);
        } catch (e) {
            console.error(e);
            alert('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const destroy = async () => {
        if (!canDelete) return alert('権限がありません。');
        if (!confirm('この勤務詳細を削除しますか？')) return;
        try {
            await axios.delete(route('shift-details.destroy', sd.id));
            onDeleted(sd.id);
        } catch (e) {
            console.error(e);
            alert('削除に失敗しました');
        }
    };

    useEffect(() => {
        if (sd && sd._openEdit) {
            setEditing(true);
        }
    }, [sd && sd._openEdit]);

    const clearOpen = () => {
        if (onClearOpen) onClearOpen(sd.id);
    };

    // prefer local absent flag which updates via global events so the row updates without full refresh
    const isAbsent = isAbsentLocal;

    return (
        <TableRow id={`sd-row-${sd.id}`} className="hover:bg-gray-50">
            <TableCell>
                <div className="flex items-center gap-2">
                    <span className="w-10 text-right font-mono text-sm">{sd.user_id ?? (sd.user && sd.user.id) ?? '—'}</span>
                    <span className={`truncate ${isAbsent ? 'text-gray-600 line-through opacity-60' : ''}`}>{sd.user ? sd.user.name : '—'}</span>
                </div>
            </TableCell>
            <TableCell>
                {editing ? (
                    <div className="flex items-center gap-2">
                        <input className="rounded border p-1 text-sm" type="time" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
                        <span className="text-muted-foreground">〜</span>
                        <input className="rounded border p-1 text-sm" type="time" value={endVal} onChange={(e) => setEndVal(e.target.value)} />
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">
                        {(timeValueFromRaw(sd.start_time) || '—') + '〜' + (timeValueFromRaw(sd.end_time) || '—')}
                    </span>
                )}
            </TableCell>
            <TableCell>
                {(() => {
                    try {
                        const st = sd.shift_type || sd.type || '';
                        if (st === 'day') return <Badge className="bg-yellow-100 text-yellow-800">昼</Badge>;
                        if (st === 'night') return <Badge className="bg-blue-100 text-blue-800">夜</Badge>;
                        return <Badge variant="outline">—</Badge>;
                    } catch (_) {
                        return <Badge variant="outline">—</Badge>;
                    }
                })()}
            </TableCell>
            <TableCell className="text-right">
                {editing ? (
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setEditing(false);
                                clearOpen();
                            }}
                            disabled={saving}
                        >
                            キャンセル
                        </Button>
                        <Button
                            onClick={async () => {
                                await save();
                                clearOpen();
                            }}
                            disabled={saving}
                        >
                            保存
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-2">
                        {!isAbsent && canUpdate && (
                            <Button variant="outline" onClick={() => setEditing(true)}>
                                編集
                            </Button>
                        )}
                        {!isAbsent && canDelete && (
                            <Button variant="destructive" onClick={destroy}>
                                削除
                            </Button>
                        )}
                    </div>
                )}
            </TableCell>
        </TableRow>
    );
}
