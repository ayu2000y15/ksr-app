import { Button } from '@/components/ui/button';
import { usePage } from '@inertiajs/react';
import axios from 'axios';
import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type BreakPayload = { shift_detail_id: number; start_time: string; end_time: string; type?: string };

type ShiftDetail = {
    id: number;
    start_time?: string | null;
    end_time?: string | null;
    date?: string | null;
    user_id?: number | null;
    user?: { id?: number; name?: string; position?: number | null } | null;
    shift_type?: string | null;
    type?: string | null;
    [key: string]: unknown;
};

type Break = {
    id?: number;
    shift_detail_id?: number;
    start_time?: string | null;
    end_time?: string | null;
    type?: string | null;
    [key: string]: unknown;
};

type Item = ShiftDetail & { sMin?: number | null; eMin?: number | null; startRaw?: string | null; endRaw?: string | null };

export default function DailyTimeline(props: {
    date: string;
    shiftDetails?: ShiftDetail[];
    initialInterval?: number;
    onBarClick?: (id: number) => void;
    mode?: 'shift' | 'break';
    breakType?: 'planned' | 'actual';
    onCreateBreak?: (p: BreakPayload) => void;
    breaks?: Break[];
}) {
    // read Inertia shared props via usePage() to reliably access users
    const page = usePage();
    const pageProps = (page && (page.props as any)) || {};
    const allUsers = pageProps.users || [];
    // users are read from Inertia page props; availableUsers is computed later after we
    // destructure props (we need `date` and `shiftDetails` to determine who is already present)
    const [showAddUser, setShowAddUser] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [adding, setAdding] = useState(false);
    const [selectedShiftType, setSelectedShiftType] = useState<'day' | 'night'>('day');
    const { date, shiftDetails = [], initialInterval = 15, onBarClick, mode, breakType, onCreateBreak, breaks = [] } = props;

    // determine which users already have a work shift on this date (present users)
    const presentUserIds = new Set<number>(
        (shiftDetails || [])
            .map((sd: any) => {
                try {
                    const startDate = sd.start_time ? String(sd.start_time).slice(0, 10) : sd.date ? String(sd.date).slice(0, 10) : null;
                    return startDate === date ? Number(sd.user_id ?? (sd.user && sd.user.id) ?? NaN) : NaN;
                } catch {
                    return NaN;
                }
            })
            .filter((n: number) => Number.isFinite(n)),
    );

    // filter only active users (status enum: 'active','retired','shared')
    // and exclude users already present on this date so dropdown shows only not-yet-scheduled users
    const availableUsers = Array.isArray(allUsers)
        ? allUsers.filter((u: any) => String(u.status ?? 'active') === 'active' && !presentUserIds.has(Number(u.id)))
        : [];
    // compute max id/position width for simple alignment in the select options
    const maxIdLen =
        Array.isArray(availableUsers) && availableUsers.length > 0
            ? Math.max(...availableUsers.map((u: any) => String(u.position ?? u.id ?? '').length))
            : 0;

    const [interval] = useState<number>(initialInterval);
    const [selTarget, setSelTarget] = useState<{ id: number | null; startIndex: number | null } | null>(null);

    const parseDbTime = (dt?: string | null) => {
        if (!dt) return null;
        const m = String(dt).match(/(\d{4})[-/ ]?(\d{2})[-/ ]?(\d{2})[T\s](\d{1,2}):(\d{2})/);
        if (!m) return null;
        return { hh: Number(m[4]), mm: Number(m[5]) };
    };

    const items = useMemo((): Item[] => {
        if (!date) return [];
        // helper to extract YYYY-MM-DD (date part) safely
        const datePart = (dt?: string | null) => (dt ? String(dt).slice(0, 10) : null);
        const parseDateOnly = (d?: string | null) => {
            const p = datePart(d);
            if (!p) return null;
            const m = p.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (!m) return null;
            return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        };

        const baseDateObj = parseDateOnly(date);

        // Only include work-type records whose START DATE equals the selected date.
        // This intentionally excludes shifts that start on a previous day even if they span into the selected date.
        const sdArray = (shiftDetails || []).filter((sd: ShiftDetail) => String(sd.type ?? '') === 'work');
        return sdArray
            .filter((sd: ShiftDetail) => {
                try {
                    const sDate = datePart(sd.start_time ?? sd.date ?? null);
                    return sDate === date;
                } catch {
                    return false;
                }
            })
            .map((sd: ShiftDetail) => {
                const s = parseDbTime(sd.start_time ?? null);
                const e = parseDbTime(sd.end_time ?? null);
                const sDateStr = datePart(sd.start_time ?? null);
                const eDateStr = datePart(sd.end_time ?? null);

                const sDateObj = parseDateOnly(sDateStr);
                const eDateObj = parseDateOnly(eDateStr);

                const dayOffset = (d?: Date | null) => {
                    if (!d || !baseDateObj) return 0;
                    const diff = Math.round((d.getTime() - baseDateObj.getTime()) / 86400000);
                    return diff;
                };

                let sMin: number | null = s ? s.hh * 60 + s.mm : null;
                let eMin: number | null = e ? e.hh * 60 + e.mm : null;

                // apply day offsets so times on the next day become >1440, previous day <0
                if (sMin !== null && sDateObj) sMin = sMin + dayOffset(sDateObj) * 1440;
                if (eMin !== null && eDateObj) eMin = eMin + dayOffset(eDateObj) * 1440;

                return { ...(sd as ShiftDetail), sMin, eMin, startRaw: sd.start_time ?? null, endRaw: sd.end_time ?? null } as Item;
            })
            .sort((a: Item, b: Item) => {
                // Primary sort: prefer user.position, then user_id, then user.id (ascending)
                const aKey = Number(a.user?.position ?? a.user_id ?? (a.user && (a.user as { id?: number }).id) ?? 0);
                const bKey = Number(b.user?.position ?? b.user_id ?? (b.user && (b.user as { id?: number }).id) ?? 0);
                if (aKey !== bKey) return aKey - bKey;

                // Secondary: start time asc
                const aStart = String(a.startRaw ?? '');
                const bStart = String(b.startRaw ?? '');
                if (aStart < bStart) return -1;
                if (aStart > bStart) return 1;
                return 0;
            });
    }, [shiftDetails, date]);

    const [timelineStartMin, timelineEndMin] = useMemo(() => {
        if (!items || items.length === 0) return [9 * 60, 18 * 60];
        const starts = items.map((it: Item) => it.sMin ?? 24 * 60);
        const ends = items.map((it: Item) => it.eMin ?? 0);
        const minStart = Math.min(...starts);
        const maxEnd = Math.max(...ends);
        const padBefore = mode === 'break' ? 120 : 60;
        const padAfter = mode === 'break' ? 240 : 120;
        const start = Math.max(0, minStart - padBefore);
        const end = maxEnd + padAfter;
        return end - start < 120 ? [Math.max(0, start - 60), Math.min(24 * 60, end + 60)] : [start, end];
    }, [items, mode]);

    const totalMinutes = timelineEndMin - timelineStartMin;
    const stepCount = Math.max(1, Math.ceil(totalMinutes / interval));
    const timeSlots = Array.from({ length: stepCount + 1 }, (_, i) => timelineStartMin + i * interval);
    // column width in px: wider in break mode to allow horizontal scroll and easier 15min clicks
    const columnWidth = mode === 'break' ? 40 : 24;

    // light shape for shift detail records used here
    type ShiftDetailLight = {
        id?: number | string;
        status?: string;
        user_id?: number | string;
        start_time?: string | null;
        end_time?: string | null;
    };

    // track absent (logical delete) flags locally so UI updates immediately
    const [absentMap, setAbsentMap] = useState<Record<number, boolean>>({});

    // initialize absentMap from items' status when items change
    useEffect(() => {
        const m: Record<number, boolean> = {};
        for (const itRaw of items) {
            const it = itRaw as ShiftDetailLight;
            const st = it.status ?? '';
            if (it.id !== undefined) m[Number(it.id)] = String(st) === 'absent';
        }
        setAbsentMap(m);
    }, [items]);

    const counts = useMemo(() => {
        const day = new Set<number>();
        const night = new Set<number>();
        const mealDay = new Set<number>();
        const mealNight = new Set<number>();
        (items || []).forEach((it: Item) => {
            const t = String(it.shift_type ?? it.type ?? '');
            const uid = Number(it.user_id ?? (it.user && (it.user as { id?: number }).id) ?? NaN);
            if (!Number.isFinite(uid)) return;
            // determine if this shift is currently marked absent (local optimistic state)
            const isAbsent = it.id !== undefined && absentMap && absentMap[Number(it.id)];

            // 出勤人数: 欠席は除外する
            if (t === 'day') {
                if (!isAbsent) day.add(uid);
                // meal_ticket: 欠席に関係なくカウントする（明示的0のみ非対象）
                const mt = (it as any).meal_ticket;
                if (mt === undefined || mt === 1 || mt === '1') mealDay.add(uid);
            } else if (t === 'night') {
                if (!isAbsent) night.add(uid);
                const mt = (it as any).meal_ticket;
                if (mt === undefined || mt === 1 || mt === '1') mealNight.add(uid);
            }
        });

        return {
            dayCount: day.size,
            nightCount: night.size,
            mealTicketDayCount: mealDay.size,
            mealTicketNightCount: mealNight.size,
        };
    }, [items, absentMap]);

    // per-slot attendance counts = number of work shifts covering the slot minus any breaks overlapping the slot
    const attendanceCounts = useMemo(() => {
        const countsArr: number[] = Array(timeSlots.length).fill(0);

        if (!items || items.length === 0) return countsArr;

        // combine breaks from prop and any shiftDetails entries of type 'break'
        // exclude breaks whose status is 'absent' so they are not shown in break mode
        const sdBreaks = (shiftDetails || []).filter(
            (s: ShiftDetail) => String(s.type ?? '') === 'break' && String((s as any).status ?? '') !== 'absent',
        );
        const combinedBreaks = [
            ...(props.breaks || []).filter((b: Break) => String((b as any).status ?? '') !== 'absent'),
            ...sdBreaks.map((s) => ({ id: s.id, shift_detail_id: s.id, start_time: s.start_time, end_time: s.end_time })),
        ];

        for (let idx = 0; idx < timeSlots.length; idx++) {
            const slotMin = timelineStartMin + idx * interval;
            const slotEndMin = slotMin + interval;

            // count work shifts covering this slot
            let workCount = 0;
            for (const it of items) {
                // skip absent shifts (absentMap keyed by shift id)
                if (it.id !== undefined && absentMap && absentMap[Number(it.id)]) continue;
                const sMin = it.sMin ?? 0;
                const eMin = it.eMin ?? sMin + 60;
                if (sMin < slotEndMin && slotMin < eMin) workCount += 1;
            }

            // count breaks (from props + shiftDetails) that overlap this slot
            const breakCount = combinedBreaks.filter((b: Break) => {
                const parse = (dt?: string | null) => {
                    if (!dt) return null;
                    const m = String(dt).match(/(\d{4})[-/ ]?(\d{2})[-/ ]?(\d{2})[T\s](\d{1,2}):(\d{2})/);
                    if (!m) return null;
                    return { hh: Number(m[4]), mm: Number(m[5]) };
                };
                // ignore breaks that belong to absent shifts
                if (b.shift_detail_id !== undefined && b.shift_detail_id !== null && absentMap && absentMap[Number(b.shift_detail_id)]) return false;
                const bs = parse(b.start_time ?? null);
                const be = parse(b.end_time ?? null);
                if (!bs || !be) return false;
                const bsMin = bs.hh * 60 + bs.mm;
                const beMin = be.hh * 60 + be.mm;
                return bsMin < slotEndMin && slotMin < beMin;
            }).length;

            countsArr[idx] = Math.max(0, workCount - breakCount);
        }

        return countsArr;
    }, [items, shiftDetails, props.breaks, timelineStartMin, interval, timeSlots, absentMap]);

    const displayDate = date ? String(date).slice(0, 10).replace(/-/g, '/') : '';

    // vertical scroll area sizing: compute available height so timeline area fits viewport
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const leftColRef = useRef<HTMLDivElement | null>(null);
    const attendanceRef = useRef<HTMLDivElement | null>(null);
    const isSyncingRef = useRef(false);
    const [scrollAreaHeight, setScrollAreaHeight] = useState<number>(400);
    useEffect(() => {
        const compute = () => {
            try {
                const top = wrapperRef.current ? wrapperRef.current.getBoundingClientRect().top : 0;
                // reserve space for surrounding chrome (header, paddings, footers).
                // Assumption: reserve ~200px; this keeps area from overflowing the viewport.
                const reserved = 200;
                const avail = Math.max(160, window.innerHeight - top - reserved);
                setScrollAreaHeight(avail);
            } catch {
                // ignore and keep previous height
            }
        };
        compute();
        window.addEventListener('resize', compute);
        // also observe body size changes if available
        let ro: ResizeObserver | null = null;
        try {
            ro = new ResizeObserver(() => compute());
            ro.observe(document.body);
        } catch {
            // ResizeObserver not available in some envs
        }
        return () => {
            window.removeEventListener('resize', compute);
            if (ro) ro.disconnect();
        };
    }, []);

    // synchronize horizontal scroll between main timeline wrapper (wrapperRef) and attendance counts (attendanceRef) in break mode
    useEffect(() => {
        if (mode !== 'break') return;
        const wr = wrapperRef.current;
        const ar = attendanceRef.current;
        const lc = leftColRef.current;
        if (!wr || !ar || !lc) return;
        const getLeftWidth = () => lc.getBoundingClientRect().width || lc.clientWidth || 0;
        const onWrapperScroll = () => {
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            requestAnimationFrame(() => {
                try {
                    const leftW = getLeftWidth();
                    ar.scrollLeft = Math.max(0, wr.scrollLeft - leftW);
                } catch {}
                isSyncingRef.current = false;
            });
        };
        const onAttendanceScroll = () => {
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            requestAnimationFrame(() => {
                try {
                    const leftW = getLeftWidth();
                    wr.scrollLeft = ar.scrollLeft + leftW;
                } catch {}
                isSyncingRef.current = false;
            });
        };
        wr.addEventListener('scroll', onWrapperScroll);
        ar.addEventListener('scroll', onAttendanceScroll);
        // initialize attendance scroll position
        try {
            const leftW = getLeftWidth();
            ar.scrollLeft = Math.max(0, wr.scrollLeft - leftW);
        } catch {}
        return () => {
            try {
                wr.removeEventListener('scroll', onWrapperScroll);
                ar.removeEventListener('scroll', onAttendanceScroll);
            } catch {}
        };
    }, [mode, timeSlots.length]);

    const addUserShift = async () => {
        if (!selectedUserId) return alert('ユーザーを選択してください');
        setAdding(true);
        try {
            // Use the bulk update endpoint so the server will create Shift and DefaultShift-based ShiftDetails
            const payload = { entries: [{ user_id: selectedUserId, date: date, shift_type: selectedShiftType }] };
            const res = await axios.post(route('shifts.bulk_update'), payload);

            // bulk_update returns a simple message on success; notify and ask parent to refresh
            try {
                // Build a temporary optimistic ShiftDetail so UI can show the new row without reloading
                const userObj = (availableUsers || []).find((u: any) => Number(u.id) === Number(selectedUserId));
                const tempId = `tmp-${Date.now()}`;
                const tempShiftDetail: any = {
                    id: tempId,
                    user_id: selectedUserId,
                    user: userObj ? { id: userObj.id, name: userObj.name } : { id: selectedUserId, name: 'ユーザー' },
                    date: date,
                    type: 'work',
                    shift_type: selectedShiftType,
                    status: 'scheduled',
                    start_time: null,
                    end_time: null,
                };

                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    // notify pages to append the optimistic row
                    window.dispatchEvent(new CustomEvent('ksr.shiftDetail.added', { detail: tempShiftDetail }));
                    window.dispatchEvent(
                        new CustomEvent('ksr.shiftDetail.toast', {
                            detail: { message: (res && res.data && res.data.message) || 'ユーザーを追加しました', type: 'success' },
                        }),
                    );
                    // attempt to fetch the authoritative ShiftDetail created by server and replace the temp row
                    (async () => {
                        const maxAttempts = 3;
                        let attempt = 0;
                        let found: any = null;
                        while (attempt < maxAttempts && !found) {
                            attempt += 1;
                            try {
                                const apiRes = await axios.get(route('shift-details.api'), { params: { date: date, user_id: selectedUserId } });
                                const list = apiRes && apiRes.data && apiRes.data.shiftDetails ? apiRes.data.shiftDetails : [];
                                if (Array.isArray(list) && list.length > 0) {
                                    // prefer a work-type entry that has start_time/end_time set
                                    found = list.find((s: any) => String(s.type ?? s.shift_type ?? '') === 'work' && (s.start_time || s.end_time));
                                    if (!found) {
                                        // fallback to first work entry
                                        found = list.find((s: any) => String(s.type ?? s.shift_type ?? '') === 'work') || null;
                                    }
                                }
                            } catch (e) {
                                // ignore and retry
                            }
                            if (!found) await new Promise((r) => setTimeout(r, 600));
                        }

                        if (found) {
                            try {
                                // dispatch replace event so the page can swap tmp row with the real record
                                window.dispatchEvent(new CustomEvent('ksr.shiftDetail.replace', { detail: { tempId, shiftDetail: found } }));
                                // also emit an updated event for compatibility
                                window.dispatchEvent(
                                    new CustomEvent('ksr.shiftDetail.updated', { detail: { id: found.id, status: found.status ?? null } }),
                                );
                            } catch {
                                // ignore
                            }
                        } else {
                            // as a fallback, request a lightweight Inertia reload (handled by page listener)
                            try {
                                window.dispatchEvent(
                                    new CustomEvent('ksr.shiftDetail.updated', { detail: { refresh: true, user_id: selectedUserId } }),
                                );
                            } catch {
                                // ignore
                            }
                        }
                    })();
                }
            } catch {
                // ignore
            }

            setShowAddUser(false);
            setSelectedUserId(null);
            setSelectedShiftType('day');
        } catch (err) {
            console.error('failed to add user shift', err);
            const msg =
                (err &&
                    (err as any).response &&
                    (err as any).response.data &&
                    ((err as any).response.data.message || JSON.stringify((err as any).response.data))) ||
                '追加に失敗しました';
            try {
                if (typeof window !== 'undefined' && window.dispatchEvent)
                    window.dispatchEvent(new CustomEvent('ksr.shiftDetail.toast', { detail: { message: msg, type: 'error' } }));
            } catch {
                // ignore
            }
        } finally {
            setAdding(false);
        }
    };

    const toggleAbsent = async (id: number, makeAbsent: boolean) => {
        // optimistic update
        setAbsentMap((prev) => ({ ...prev, [id]: makeAbsent }));
        try {
            // find existing record to include required start_time/end_time per controller validation
            const existing = (shiftDetails || []).find((s: ShiftDetail) => Number(s.id) === Number(id));
            if (!existing) {
                throw new Error('該当の勤務詳細が見つかりません');
            }
            const payload: { status: string; start_time?: string | null; end_time?: string | null } = { status: makeAbsent ? 'absent' : 'scheduled' };
            // prefer explicit start_time/end_time fields returned from server
            payload.start_time = existing.start_time ?? null;
            payload.end_time = existing.end_time ?? null;

            // if we don't have start/end, revert and notify user
            if (!payload.start_time || !payload.end_time) {
                setAbsentMap((prev) => ({ ...prev, [id]: !makeAbsent }));
                alert('勤務の開始／終了時刻が不明なため欠席にできません。');
                return;
            }

            await axios.patch(route('shift-details.update', id), payload);
            // notify other components (e.g., BreakTimeline) so they can update immediately
            try {
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('ksr.shiftDetail.updated', { detail: { id, status: payload.status } }));
                }
            } catch {
                // ignore
            }
            // dispatch a toast event for UI feedback
            try {
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    const msg = payload.status === 'absent' ? '欠席にしました' : '欠席を解除しました';
                    window.dispatchEvent(new CustomEvent('ksr.shiftDetail.toast', { detail: { id, status: payload.status, message: msg } }));
                }
            } catch {
                // ignore
            }
        } catch (err) {
            console.error('failed to update absent status', err);
            // revert
            setAbsentMap((prev) => ({ ...prev, [id]: !makeAbsent }));
            alert('欠席の更新に失敗しました');
        }
    };

    const toDbString = (m: number) => {
        const hh = String(Math.floor((m % (24 * 60)) / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        const d = String(date).slice(0, 10);
        return `${d} ${hh}:${mm}:00`;
    };

    return (
        <div className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-medium">{displayDate}</div>
                {mode === 'break' && (
                    <div className="flex items-center gap-3">
                        <label className="text-sm">グリッド間隔:</label>
                        <span className="rounded border bg-gray-50 p-1 text-sm">{String(initialInterval)}分</span>
                    </div>
                )}
            </div>

            <div ref={wrapperRef} className="overflow-x-auto">
                {/* Header/time ruler: use fixed wide columns only in break mode; keep original flexible grid for shift mode */}
                {mode === 'break' ? (
                    <div className="min-w-full">
                        <div className="flex items-stretch border-b">
                            <div ref={leftColRef} className="w-28 sm:w-48">
                                <div className="flex h-10 items-center border-b">
                                    <span className="text-xs">欠席</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div style={{ minWidth: `${timeSlots.length * columnWidth}px` }}>
                                    <div className="grid" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${columnWidth}px)` }}>
                                        {timeSlots.map((t, i) => (
                                            <div key={t + ':' + i} className="border-l py-1 text-center text-xs text-muted-foreground">
                                                {i % Math.max(1, Math.floor(60 / interval)) === 0 ? String(Math.floor((t % 1440) / 60)) : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // shift mode: simplify header (no top time ruler) to avoid visual clutter
                    <div className="min-w-full">
                        <div className="flex items-stretch border-b">
                            <div className="w-28 sm:w-48">
                                <div className="flex h-10 items-center border-b">
                                    <span className="text-sm">欠席</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="h-10 border-b" />
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ maxHeight: `${scrollAreaHeight}px`, overflowY: 'auto' }} className="mt-2 space-y-2">
                    {items
                        .filter((it: Item) => {
                            // In break mode, skip shifts that are absent (database status) or locally marked absent
                            if (mode === 'break') {
                                const dbStatus = String((it as any).status ?? '');
                                if (dbStatus === 'absent') return false;
                                if (it.id !== undefined && absentMap && absentMap[Number(it.id)]) return false;
                            }
                            return true;
                        })
                        .map((it: Item) => {
                            const sMin = it.sMin ?? 0;
                            const eMin = it.eMin ?? sMin + 60;
                            const rawLeft = ((sMin - timelineStartMin) / totalMinutes) * 100;
                            const rawWidth = ((eMin - sMin) / totalMinutes) * 100;
                            const leftPercent = Number.isFinite(rawLeft) ? Math.max(0, Math.min(100, rawLeft)) : 0;
                            const widthPercent = Number.isFinite(rawWidth) ? Math.max(0, Math.min(100 - leftPercent, rawWidth)) : 0;
                            const totalPixelWidth = timeSlots.length * columnWidth;
                            // when in break mode we render the grid with fixed pixel columns; compute px positions
                            const barLeftPx = ((sMin - timelineStartMin) / totalMinutes) * totalPixelWidth;
                            const barWidthPx = ((eMin - sMin) / totalMinutes) * totalPixelWidth;
                            const startLabel = parseDbTime(it.startRaw);
                            const endLabel = parseDbTime(it.endRaw);

                            return (
                                <div key={it.id} className="flex items-center gap-4">
                                    <div className="flex w-28 items-center font-medium sm:w-48">
                                        {/* checkbox for marking absent */}
                                        <input
                                            type="checkbox"
                                            className="mr-2"
                                            checked={!!absentMap[Number(it.id ?? 0)]}
                                            onChange={(e) => toggleAbsent(Number(it.id ?? 0), e.target.checked)}
                                            title="チェックで欠席扱い"
                                        />
                                        <span className="mr-2 w-6 text-right font-mono text-sm">
                                            {it.user?.position ?? it.user_id ?? (it.user && it.user.id) ?? '—'}
                                        </span>
                                        <span className={`truncate ${absentMap[Number(it.id ?? 0)] ? 'text-gray-600 line-through opacity-60' : ''}`}>
                                            {it.user ? it.user.name : '—'}
                                        </span>
                                        {/* show a small badge when this shift is marked step_out (中抜け)
                                            step_out may be included either at top-level or nested under `shift` (from backend),
                                            so check both locations. treat '1' or 1 as true. */}
                                        {(() => {
                                            const sVal = (it as any).step_out ?? ((it as any).shift && (it as any).shift.step_out);
                                            if (!(sVal === 1 || sVal === '1')) return null;
                                            const op = absentMap[Number(it.id ?? 0)] ? 'opacity-60' : '';
                                            return (
                                                <>
                                                    {/* full badge on md and larger */}
                                                    <span
                                                        className={`ml-2 hidden items-center rounded bg-orange-100 px-1 text-xs text-orange-700 md:inline-flex ${op}`}
                                                        title="中抜け"
                                                    >
                                                        中抜け
                                                    </span>
                                                    {/* compact circle icon on small screens */}
                                                    <span
                                                        className={`ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xs text-orange-700 md:hidden ${op}`}
                                                        title="中抜け"
                                                        aria-label="中抜け"
                                                    >
                                                        ○
                                                    </span>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div className="relative h-10 flex-1">
                                        <div
                                            className="absolute inset-0 bg-gray-50"
                                            style={mode === 'break' ? { minWidth: `${timeSlots.length * columnWidth}px` } : undefined}
                                        >
                                            {mode === 'break' && (
                                                <div
                                                    className="grid"
                                                    style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${columnWidth}px)` }}
                                                >
                                                    {timeSlots.map((t, idx) => {
                                                        const slotMin = timelineStartMin + idx * interval;
                                                        const within = slotMin >= sMin && slotMin <= eMin;
                                                        // determine if this slot already contains a break for this user
                                                        type CombinedBreak = {
                                                            id?: number | null;
                                                            user_id?: number | null;
                                                            start_time?: string | null;
                                                            end_time?: string | null;
                                                            shift_detail_id?: number | null;
                                                        };
                                                        const sdBreaksLocal = (shiftDetails || []).filter(
                                                            (s: ShiftDetail) =>
                                                                String(s.type ?? '') === 'break' && String((s as any).status ?? '') !== 'absent',
                                                        );
                                                        const combinedBreaksLocal: CombinedBreak[] = [
                                                            ...(props.breaks || [])
                                                                .filter((b: Break) => String((b as any).status ?? '') !== 'absent')
                                                                .map((b) => ({
                                                                    id: b.id ?? null,
                                                                    user_id: (b as unknown as { user_id?: number | null }).user_id ?? null,
                                                                    start_time: b.start_time ?? null,
                                                                    end_time: b.end_time ?? null,
                                                                    shift_detail_id: b.shift_detail_id ?? null,
                                                                    status: (b as any).status ?? 'scheduled',
                                                                })),
                                                            ...sdBreaksLocal.map((s) => ({
                                                                id: s.id ?? null,
                                                                user_id: s.user_id ?? null,
                                                                start_time: s.start_time ?? null,
                                                                end_time: s.end_time ?? null,
                                                                shift_detail_id: s.id ?? null,
                                                                status: (s as any).status ?? 'scheduled',
                                                            })),
                                                        ];

                                                        const overlappingBreaksForUser = combinedBreaksLocal.filter((b) => {
                                                            // belong if user_id matches OR shift_detail_id matches
                                                            const belongsToUser =
                                                                (b.shift_detail_id !== undefined &&
                                                                    b.shift_detail_id !== null &&
                                                                    Number(b.shift_detail_id) === Number(it.id)) ||
                                                                (b.user_id !== undefined &&
                                                                    b.user_id !== null &&
                                                                    Number(b.user_id) === Number(it.user_id));
                                                            if (!belongsToUser) return false;
                                                            // ignore our own break when deduping
                                                            if (Number(b.id) === Number(it.id)) return false;
                                                            const bs = parseDbTime(b.start_time ?? null);
                                                            const be = parseDbTime(b.end_time ?? null);
                                                            if (!bs || !be) return false;
                                                            const bsMin = bs.hh * 60 + bs.mm;
                                                            const beMin = be.hh * 60 + be.mm;
                                                            return bsMin < slotMin + interval && slotMin < beMin;
                                                        });

                                                        const hasAnyBreakOverlap = overlappingBreaksForUser.length > 0;
                                                        const hasActualBreakOverlap = overlappingBreaksForUser.some(
                                                            (b) => (b as any).status === 'actual',
                                                        );

                                                        let slotBlocked = false;
                                                        if (hasActualBreakOverlap) slotBlocked = true;
                                                        else if (hasAnyBreakOverlap && breakType !== 'actual') slotBlocked = true;
                                                        const clickable = mode === 'break' && within && !slotBlocked;
                                                        return (
                                                            <div
                                                                key={`${it.id}-slot-${idx}`}
                                                                className={`border-l ${clickable ? 'cursor-pointer' : 'pointer-events-none'}`}
                                                                onClick={() => {
                                                                    if (!clickable) return;
                                                                    if (!selTarget || selTarget.id !== it.id) {
                                                                        setSelTarget({ id: it.id, startIndex: idx });
                                                                        return;
                                                                    }
                                                                    const sIndex = selTarget.startIndex ?? idx;
                                                                    const eIndex = idx;
                                                                    const s = timelineStartMin + Math.min(sIndex, eIndex) * interval;
                                                                    const e = timelineStartMin + Math.max(sIndex, eIndex) * interval;
                                                                    if (onCreateBreak) {
                                                                        onCreateBreak({
                                                                            shift_detail_id: it.id as number,
                                                                            start_time: toDbString(s),
                                                                            end_time: toDbString(e),
                                                                            type: breakType,
                                                                        });
                                                                        setSelTarget(null);
                                                                    }
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* shift bar: in break mode make bars more muted */}
                                        <div
                                            className={`absolute top-1 flex h-8 items-center overflow-hidden rounded ${mode === 'break' ? (it.shift_type === 'night' ? 'text-indigo-800/60' : 'text-yellow-900/60') : it.shift_type === 'night' ? 'bg-indigo-700/60 text-white' : 'bg-yellow-400/80 text-black'}`}
                                            style={(() => {
                                                const base =
                                                    mode === 'break'
                                                        ? {
                                                              left: `${Math.max(0, barLeftPx)}px`,
                                                              width: `${Math.max(0, barWidthPx)}px`,
                                                              zIndex: 10,
                                                              pointerEvents: 'none' as const,
                                                          }
                                                        : {
                                                              left: `${leftPercent}%`,
                                                              width: `${widthPercent}%`,
                                                              zIndex: 10,
                                                              pointerEvents: 'auto' as const,
                                                          };
                                                if (it.id !== undefined && absentMap && absentMap[Number(it.id)]) {
                                                    // muted gray background for absent rows
                                                    return { ...base, backgroundColor: '#e5e7eb' };
                                                }
                                                return base;
                                            })()}
                                            onClick={() => {
                                                const isAbsent = it.id !== undefined && absentMap && absentMap[Number(it.id)];
                                                if (isAbsent) return; // ignore clicks for absent rows
                                                if (onBarClick) onBarClick(it.id);
                                            }}
                                        >
                                            <div
                                                className="px-2 text-sm"
                                                style={{
                                                    cursor:
                                                        it.id !== undefined && absentMap && absentMap[Number(it.id)]
                                                            ? 'not-allowed'
                                                            : onBarClick
                                                              ? 'pointer'
                                                              : undefined,
                                                }}
                                            >
                                                {mode === 'break'
                                                    ? ''
                                                    : startLabel && endLabel
                                                      ? `${String(startLabel.hh).padStart(2, '0')}:${String(startLabel.mm).padStart(2, '0')} - ${String(endLabel.hh).padStart(2, '0')}:${String(endLabel.mm).padStart(2, '0')}`
                                                      : '時間未設定'}
                                            </div>

                                            {/* render breaks on bar (lighter color) */}
                                            {breaks &&
                                                breaks
                                                    .filter(
                                                        (b: Break) =>
                                                            Number(b.shift_detail_id) === Number(it.id) &&
                                                            String((b as any).status ?? '') !== 'absent',
                                                    )
                                                    .map((b: Break) => {
                                                        const bs = parseDbTime(b.start_time ?? null);
                                                        const be = parseDbTime(b.end_time ?? null);
                                                        if (!bs || !be) return null;
                                                        const bsMin = bs.hh * 60 + bs.mm;
                                                        const beMin = be.hh * 60 + be.mm;
                                                        const bgColor = it.shift_type === 'night' ? 'rgba(79,70,229,0.7)' : 'rgba(245,158,11,0.7)';
                                                        if (mode === 'break') {
                                                            const breakLeftPx = ((bsMin - timelineStartMin) / totalMinutes) * totalPixelWidth;
                                                            const breakWidthPx = ((beMin - bsMin) / totalMinutes) * totalPixelWidth;
                                                            const relLeft = breakLeftPx - barLeftPx;
                                                            return (
                                                                <div
                                                                    key={b.id}
                                                                    className="absolute top-0 h-full border-r border-l border-white/40"
                                                                    style={{
                                                                        left: `${Math.max(0, relLeft)}px`,
                                                                        width: `${Math.max(0, Math.min(totalPixelWidth, breakWidthPx))}px`,
                                                                        zIndex: 20,
                                                                        backgroundColor: bgColor,
                                                                    }}
                                                                />
                                                            );
                                                        }
                                                        const left = ((bsMin - timelineStartMin) / totalMinutes) * 100 - leftPercent;
                                                        const width = ((beMin - bsMin) / totalMinutes) * 100;
                                                        return (
                                                            <div
                                                                key={b.id}
                                                                className="absolute top-0 h-full border-r border-l border-white/40"
                                                                style={{
                                                                    left: `${Math.max(0, left)}%`,
                                                                    width: `${Math.max(0, Math.min(100, width))}%`,
                                                                    zIndex: 20,
                                                                    backgroundColor: bgColor,
                                                                    // scheduled breaks should be pointer-transparent when creating actual breaks
                                                                    pointerEvents:
                                                                        (b as any).status === 'scheduled' && breakType === 'actual' ? 'none' : 'auto',
                                                                }}
                                                            />
                                                        );
                                                    })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                <div className="mt-4 border-t pt-3">
                    <div className="flex justify-start gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center font-medium">
                            <span>出勤人数</span>
                            <Button size="sm" variant="ghost" className="ml-3" title="ユーザーを追加" onClick={() => setShowAddUser((s) => !s)}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">昼 </span>
                            <span className="ml-1 font-medium text-yellow-800">
                                {counts.dayCount}人
                                {typeof counts.mealTicketDayCount !== 'undefined' && (
                                    <span className="ml-2 text-sm text-muted-foreground">（食券 {counts.mealTicketDayCount}）</span>
                                )}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">夜 </span>
                            <span className="ml-1 font-medium text-indigo-700">
                                {counts.nightCount}人
                                {typeof counts.mealTicketNightCount !== 'undefined' && (
                                    <span className="ml-2 text-sm text-muted-foreground">（食券 {counts.mealTicketNightCount}）</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* 小さな追加フォーム */}
                    {showAddUser && (
                        <div className="mt-2 flex items-center gap-3">
                            <div>
                                <select
                                    value={selectedUserId ?? ''}
                                    onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                                    className="rounded border p-2 text-sm"
                                    style={{ minWidth: 180 }}
                                >
                                    <option value="">-- ユーザーを選択 --</option>
                                    {(availableUsers || []).map((u: any) => (
                                        <option key={u.id} value={u.id}>
                                            {`${String(u.position ?? u.id ?? '').padStart(maxIdLen, ' ')} ${u.name}`}
                                        </option>
                                    ))}
                                </select>
                                {(!availableUsers || availableUsers.length === 0) && (
                                    <div className="mt-1 text-xs text-muted-foreground">追加可能なユーザーがいません。</div>
                                )}
                            </div>

                            {/* day/night radio */}
                            <div className="flex items-center gap-3 text-sm">
                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="ksr_shift_type"
                                        value="day"
                                        checked={selectedShiftType === 'day'}
                                        onChange={() => setSelectedShiftType('day')}
                                    />
                                    <span className="ml-1">昼</span>
                                </label>
                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="ksr_shift_type"
                                        value="night"
                                        checked={selectedShiftType === 'night'}
                                        onChange={() => setSelectedShiftType('night')}
                                    />
                                    <span className="ml-1">夜</span>
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button size="sm" onClick={addUserShift} disabled={adding || !selectedUserId}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    追加
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                        setShowAddUser(false);
                                        setSelectedUserId(null);
                                        setSelectedShiftType('day');
                                    }}
                                >
                                    <X className="mr-1 h-4 w-4" />
                                    キャンセル
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* per-slot attendance counts only visible in break mode */}
                    {mode === 'break' && (
                        <div className="mt-2">
                            <div className="flex items-center">
                                <div className="w-48" />
                                <div ref={attendanceRef} className="flex-1 overflow-x-auto">
                                    <div style={{ minWidth: `${timeSlots.length * columnWidth}px` }}>
                                        <div className="grid" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${columnWidth}px)` }}>
                                            {attendanceCounts.map((c, i) => (
                                                <div key={`att-${i}`} className="h-6 border-l text-center text-sm font-medium">
                                                    {c}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {items.length === 0 && <div className="mt-4 text-sm text-muted-foreground">この日の勤務詳細はありません。</div>}
            </div>
        </div>
    );
}
