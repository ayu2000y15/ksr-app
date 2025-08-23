import DailyTimeline from '@/components/shifts/daily-timeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

    // keep local state in sync if props change (Inertia navigation)
    useEffect(() => {
        setShiftDetails(props?.shiftDetails || []);
    }, [props?.shiftDetails]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={`日間タイムライン ${displayDate || ''}`} />
            <div className="p-4 sm:p-6 lg:p-8">
                <DailyTimeline
                    date={date}
                    shiftDetails={shiftDetails}
                    initialInterval={15}
                    onBarClick={(id: number) => {
                        // open edit for the shift detail with id, scroll into view
                        setShiftDetails((prev) => prev.map((p) => (p.id === id ? { ...p, _openEdit: true } : { ...p, _openEdit: false })));
                        setTimeout(() => {
                            const el = document.getElementById(`sd-row-${id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 120);
                    }}
                />

                {/* editable list below the timeline (same design as シフト一覧) */}
                <div className="mt-6">
                    <Card>
                        <CardHeader className="flex items-center justify-between">
                            <CardTitle>シフト一覧</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ユーザーID</TableHead>
                                        <TableHead>ユーザー</TableHead>
                                        <TableHead>時間</TableHead>
                                        <TableHead>昼/夜</TableHead>
                                        <TableHead className="text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        // Filter to only the shiftDetails that start on the requested date
                                        const filtered = (shiftDetails || []).filter((sd: any) => {
                                            try {
                                                if (sd.start_time) return String(sd.start_time).startsWith(String(date));
                                                if (sd.date) return String(sd.date).startsWith(String(date));
                                                return false;
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
                                                                prev.map((p) => (p.id === updated.id ? { ...p, ...updated, _openEdit: false } : p)),
                                                            );
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
                </div>
            </div>
        </AppSidebarLayout>
    );
}

function timeValueFromRaw(raw?: string | null) {
    if (!raw) return '';
    const m = String(raw).match(/(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return '';
    return `${m[1]}:${m[2]}`;
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
    const [startVal, setStartVal] = useState<string>(timeValueFromRaw(sd.start_time ?? sd.startRaw ?? null));
    const [endVal, setEndVal] = useState<string>(timeValueFromRaw(sd.end_time ?? sd.endRaw ?? null));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setStartVal(timeValueFromRaw(sd.start_time ?? sd.startRaw ?? null));
        setEndVal(timeValueFromRaw(sd.end_time ?? sd.endRaw ?? null));
    }, [sd]);

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

    return (
        <TableRow id={`sd-row-${sd.id}`} className="hover:bg-gray-50">
            <TableCell className="font-mono text-sm">{sd.user_id ?? (sd.user && sd.user.id) ?? '—'}</TableCell>
            <TableCell>{sd.user ? sd.user.name : '—'}</TableCell>
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
                        {canUpdate && (
                            <Button variant="outline" onClick={() => setEditing(true)}>
                                編集
                            </Button>
                        )}
                        {canDelete && (
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
