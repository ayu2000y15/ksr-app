import { useCallback, useEffect, useMemo, useState } from 'react';

type ShiftDetail = {
    id: number;
    start_time?: string | null;
    end_time?: string | null;
    date?: string | null;
    user_id?: number | null;
    user?: { id?: number; name?: string } | null;
    shift_type?: string | null;
    type?: string | null;
    status?: string | null;
    [key: string]: unknown;
};

type Break = {
    id?: number;
    shift_detail_id?: number;
    start_time?: string | null;
    end_time?: string | null;
    type?: string | null;
    user_id?: number | null;
    status?: string | null;
    [key: string]: unknown;
};

type Item = ShiftDetail & { sMin?: number | null; eMin?: number | null; startRaw?: string | null; endRaw?: string | null };

type BreakPayload = { shift_detail_id: number; start_time: string; end_time: string; type?: string };

export default function BreakTimeline(props: {
    date: string;
    shiftDetails?: ShiftDetail[];
    initialInterval?: number;
    breakType?: 'planned' | 'actual';
    onBarClick?: (id: number) => void;
    onCreateBreak?: (p: BreakPayload) => void;
    breaks?: Break[];
}) {
    const { date, shiftDetails = [], initialInterval = 15, breakType = 'planned', onCreateBreak, breaks = [] } = props;

    const [interval, setInterval] = useState<number>(initialInterval);
    useEffect(() => setInterval(initialInterval), [initialInterval]);
    const [selTarget, setSelTarget] = useState<{ id: number | null; startIndex: number | null } | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const parseDbTime = (dt?: string | null) => {
        if (!dt) return null;
        const m = String(dt).match(/(\d{4})[-/ ]?(\d{2})[-/ ]?(\d{2})[T\s](\d{1,2}):(\d{2})/);
        if (!m) return null;
        return { hh: Number(m[4]), mm: Number(m[5]) };
    };

    const datePart = (dt?: string | null) => (dt ? String(dt).slice(0, 10) : null);
    const parseDateOnly = useCallback((d?: string | null) => {
        const p = datePart(d);
        if (!p) return null;
        const m = p.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }, []);

    const baseDateObj = parseDateOnly(date);

    const items = useMemo((): Item[] => {
        const parse = (sd: ShiftDetail) => {
            const s = parseDbTime(sd.start_time ?? null);
            const e = parseDbTime(sd.end_time ?? null);
            const sDateStr = datePart(sd.start_time ?? null);
            const eDateStr = datePart(sd.end_time ?? null);
            const sDateObj = parseDateOnly(sDateStr);
            const eDateObj = parseDateOnly(eDateStr);
            const dayOffset = (d?: Date | null) => {
                if (!d || !baseDateObj) return 0;
                return Math.round((d.getTime() - baseDateObj.getTime()) / 86400000);
            };
            let sMin: number | null = s ? s.hh * 60 + s.mm : null;
            let eMin: number | null = e ? e.hh * 60 + e.mm : null;
            if (sMin !== null && sDateObj) sMin = sMin + dayOffset(sDateObj) * 1440;
            if (eMin !== null && eDateObj) eMin = eMin + dayOffset(eDateObj) * 1440;
            return { ...(sd as ShiftDetail), sMin, eMin, startRaw: sd.start_time ?? null, endRaw: sd.end_time ?? null } as Item;
        };

        return (shiftDetails || [])
            .filter((sd) => String(sd.type ?? '') === 'work')
            .filter((sd) => {
                const sDate = sd.start_time ? String(sd.start_time).slice(0, 10) : sd.date ? String(sd.date).slice(0, 10) : null;
                return sDate === date;
            })
            .map(parse)
            .sort((a: Item, b: Item) => {
                const rank = (sd: Item) => {
                    const t = String(sd.shift_type ?? sd.type ?? '');
                    if (t === 'day') return 0;
                    if (t === 'night') return 2;
                    return 1;
                };
                const ra = rank(a);
                const rb = rank(b);
                if (ra !== rb) return ra - rb;
                const aUid = Number(a.user_id ?? (a.user && (a.user as { id?: number }).id) ?? 0);
                const bUid = Number(b.user_id ?? (b.user && (b.user as { id?: number }).id) ?? 0);
                if (aUid !== bUid) return aUid - bUid;
                const aStart = String(a.startRaw ?? '');
                const bStart = String(b.startRaw ?? '');
                if (aStart < bStart) return -1;
                if (aStart > bStart) return 1;
                return 0;
            });
    }, [shiftDetails, date, baseDateObj, parseDateOnly]);

    const [timelineStartMin, timelineEndMin] = useMemo(() => {
        if (!items || items.length === 0) return [9 * 60, 18 * 60];
        const starts = items.map((it) => it.sMin ?? 24 * 60);
        const ends = items.map((it) => it.eMin ?? 0);
        const minStart = Math.min(...starts);
        const maxEnd = Math.max(...ends);

        const padBefore = 120;
        const padAfter = 240;

        const rawStart = Math.max(0, minStart - padBefore);
        const start = rawStart - (rawStart % interval);

        const rawEnd = maxEnd + padAfter;
        const end = rawEnd - (rawEnd % interval) + interval;

        return end - start < 120 ? [start - 60, end + 60] : [start, end];
    }, [items, interval]);

    const totalMinutes = timelineEndMin - timelineStartMin;
    const stepCount = Math.max(1, Math.ceil(totalMinutes / interval));
    const timeSlots = Array.from({ length: stepCount + 1 }, (_, i) => timelineStartMin + i * interval);
    const columnWidth = 40;
    const totalPixelWidth = timeSlots.length * columnWidth;

    const combinedBreaksMemo = useMemo(() => {
        const sdBreaks = (shiftDetails || []).filter((s) => String(s.type ?? '') === 'break');
        const rawCombined = [...(breaks || []), ...sdBreaks];
        const m = new Map<string, Break>();
        for (const b of rawCombined) {
            const key = b.id ?? `${b.start_time ?? ''}-${b.end_time ?? ''}`;
            const k = String(key);
            if (!m.has(k)) m.set(k, b);
        }
        return Array.from(m.values());
    }, [breaks, shiftDetails]);

    const attendanceCounts = useMemo(() => {
        const counts: number[] = Array(timeSlots.length).fill(0);
        if (!items || items.length === 0) return counts;

        const combinedBreaks = combinedBreaksMemo;

        const dayOffset = (d?: Date | null) => {
            if (!d || !baseDateObj) return 0;
            return Math.round((d.getTime() - baseDateObj.getTime()) / 86400000);
        };

        for (let idx = 0; idx < timeSlots.length; idx++) {
            const slotMin = timelineStartMin + idx * interval;
            const slotEndMin = slotMin + interval;

            let workCount = 0;
            for (const it of items) {
                const sMin = it.sMin ?? 0;
                const eMin = it.eMin ?? sMin + 60;
                if (sMin < slotEndMin && slotMin < eMin) workCount += 1;
            }

            // Count number of distinct users who have any break overlapping this slot.
            // This ensures that if the same user has both a scheduled and an actual break
            // overlapping the same time, we only subtract once.
            const overlappingBreaks = combinedBreaks.filter((b) => {
                const bs_parsed = parseDbTime(b.start_time ?? null);
                const be_parsed = parseDbTime(b.end_time ?? null);
                if (!bs_parsed || !be_parsed) return false;

                const breakStartDate = parseDateOnly(b.start_time);
                const bsMin = bs_parsed.hh * 60 + bs_parsed.mm + dayOffset(breakStartDate) * 1440;
                const breakEndDate = parseDateOnly(b.end_time);
                const beMinRaw = be_parsed.hh * 60 + be_parsed.mm + dayOffset(breakEndDate) * 1440;
                const beMin = beMinRaw < bsMin ? beMinRaw + 1440 : beMinRaw;

                return bsMin < slotEndMin && slotMin < beMin;
            });

            const usersOnBreak = new Set<string>();
            for (const b of overlappingBreaks) {
                if (b.user_id !== undefined && b.user_id !== null) {
                    usersOnBreak.add(String(b.user_id));
                } else if (b.shift_detail_id !== undefined && b.shift_detail_id !== null) {
                    usersOnBreak.add(`sd:${String(b.shift_detail_id)}`);
                } else if (b.id !== undefined && b.id !== null) {
                    usersOnBreak.add(`id:${String(b.id)}`);
                } else {
                    usersOnBreak.add(`${b.start_time ?? ''}-${b.end_time ?? ''}`);
                }
            }

            const breakCount = usersOnBreak.size;

            counts[idx] = Math.max(0, workCount - breakCount);
        }

        return counts;
    }, [items, timelineStartMin, interval, timeSlots, combinedBreaksMemo, baseDateObj, parseDateOnly]);

    const toDbString = (m: number) => {
        const dayOffset = Math.floor(m / 1440);
        const mm = m % 60;
        const hh = Math.floor((m % 1440) / 60);
        const d = String(date).slice(0, 10);
        if (dayOffset === 0) return `${d} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
        const parts = d.split('-').map((p) => parseInt(p, 10));
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        dt.setDate(dt.getDate() + dayOffset);
        const Y = dt.getFullYear();
        const M = String(dt.getMonth() + 1).padStart(2, '0');
        const DD = String(dt.getDate()).padStart(2, '0');
        return `${Y}-${M}-${DD} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
    };

    return (
        <div className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-medium">{date ? String(date).slice(0, 10).replace(/-/g, '/') : ''}</div>
                <div className="flex items-center gap-3">
                    <label className="text-sm">グリッド間隔:</label>
                    <span className="rounded border bg-gray-50 p-1 text-sm">{String(initialInterval)}分</span>
                </div>
            </div>

            <div className="flex">
                <div className="w-28 flex-shrink-0 sm:w-48">
                    <div className="h-10 border-b bg-white" />
                    <div className="space-y-2">
                        {items.map((it) => (
                            <div key={`label-${it.id}`} className="flex h-10 items-center border-b bg-white pr-2">
                                <span className="mr-2 w-6 text-right font-mono text-sm">{it.user_id ?? (it.user && it.user.id) ?? '—'}</span>
                                <span className="truncate">{it.user ? it.user.name : '—'}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex h-6 items-center border-t bg-white p-4 text-sm font-medium text-muted-foreground">出勤人数</div>
                </div>

                <div className="flex-1 overflow-x-auto">
                    <div style={{ minWidth: `${totalPixelWidth}px` }}>
                        <div className="grid h-10 items-center" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${columnWidth}px)` }}>
                            {timeSlots.map((t, i) => {
                                const displayTime = t;
                                const displayHour = Math.floor((displayTime % 1440) / 60);
                                return (
                                    <div key={t + ':' + i} className="border-l py-1 text-center text-xs text-muted-foreground">
                                        {(i - 2) % Math.max(1, Math.floor(60 / interval)) === 0
                                            ? String(displayHour >= 0 ? displayHour : displayHour + 24)
                                            : ''}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-2">
                            {items.map((it) => {
                                const sMin = it.sMin ?? 0;
                                const eMin = it.eMin ?? sMin + 60;
                                const currentUserId = it.user_id ?? (it.user && it.user.id) ?? null;

                                return (
                                    <div key={`row-${it.id}`} className="relative h-10 border-b bg-white">
                                        <div
                                            className="grid"
                                            style={{
                                                minWidth: `${totalPixelWidth}px`,
                                                gridTemplateColumns: `repeat(${timeSlots.length}, ${columnWidth}px)`,
                                            }}
                                        >
                                            {timeSlots.map((_, idx) => {
                                                const slotMin = timelineStartMin + idx * interval;
                                                const slotEndMin = slotMin + interval;
                                                const isWithinShift = sMin < slotEndMin && slotMin < eMin;

                                                const isBreak = combinedBreaksMemo
                                                    .filter((b) => Number(b.user_id) === Number(currentUserId))
                                                    .some((b) => {
                                                        const bs_parsed = parseDbTime(b.start_time ?? null);
                                                        const be_parsed = parseDbTime(b.end_time ?? null);
                                                        if (!bs_parsed || !be_parsed) return false;

                                                        const dayOffset = (d?: Date | null) => {
                                                            if (!d || !baseDateObj) return 0;
                                                            return Math.round((d.getTime() - baseDateObj.getTime()) / 86400000);
                                                        };

                                                        const breakStartDate = parseDateOnly(b.start_time);
                                                        const bsMin = bs_parsed.hh * 60 + bs_parsed.mm + dayOffset(breakStartDate) * 1440;
                                                        const breakEndDate = parseDateOnly(b.end_time);
                                                        const beMinRaw = be_parsed.hh * 60 + be_parsed.mm + dayOffset(breakEndDate) * 1440;
                                                        const beMin = beMinRaw < bsMin ? beMinRaw + 1440 : beMinRaw;

                                                        return bsMin < slotEndMin && slotMin < beMin;
                                                    });

                                                // slotBlocked: true if this slot contains a break and the selected
                                                // mode is NOT 'actual' (i.e. planned/other should be blocked)
                                                const slotBlocked = isBreak && breakType !== 'actual';

                                                const isSelectedStart = selTarget?.id === it.id && selTarget.startIndex === idx;

                                                let isWithinHoverRange = false;
                                                if (selTarget?.id === it.id && selTarget.startIndex !== null && hoverIndex !== null) {
                                                    const start = Math.min(selTarget.startIndex, hoverIndex);
                                                    const end = Math.max(selTarget.startIndex, hoverIndex);
                                                    isWithinHoverRange = idx >= start && idx <= end;
                                                }
                                                const cellClasses = [
                                                    'h-10 border-l transition-colors duration-75',
                                                    // clickable only when within shift and not blocked
                                                    isWithinShift && !slotBlocked ? 'cursor-pointer' : 'bg-gray-50 pointer-events-none',
                                                    isWithinShift &&
                                                        !isWithinHoverRange &&
                                                        (it.shift_type === 'night' ? 'bg-indigo-200' : 'bg-yellow-200'),
                                                    // allow hover highlight even if existing break when creating 'actual'
                                                    isWithinHoverRange && !slotBlocked && 'bg-green-300',
                                                    isSelectedStart && 'ring-2 ring-blue-500 z-10',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ');

                                                return (
                                                    <div
                                                        key={`${it.id}-slot-${idx}`}
                                                        className={cellClasses}
                                                        onMouseEnter={() => {
                                                            if (selTarget && selTarget.id === it.id && !slotBlocked) {
                                                                setHoverIndex(idx);
                                                            }
                                                        }}
                                                        onClick={() => {
                                                            if (!isWithinShift || slotBlocked) return;
                                                            if (!selTarget || selTarget.id !== it.id) {
                                                                setSelTarget({ id: it.id, startIndex: idx });
                                                                return;
                                                            }
                                                            const sIndex = selTarget.startIndex ?? idx;
                                                            const eIndex = idx;
                                                            const s = timelineStartMin + Math.min(sIndex, eIndex) * interval;
                                                            const e = timelineStartMin + Math.max(sIndex, eIndex) * interval + interval;
                                                            if (onCreateBreak) {
                                                                onCreateBreak({
                                                                    shift_detail_id: it.id as number,
                                                                    start_time: toDbString(s),
                                                                    end_time: toDbString(e),
                                                                    type: breakType,
                                                                });
                                                            }
                                                            setSelTarget(null);
                                                            setHoverIndex(null);
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>

                                        <div className="pointer-events-none absolute inset-0">
                                            {combinedBreaksMemo &&
                                                combinedBreaksMemo
                                                    .filter((b) => Number(b.user_id) === Number(currentUserId))
                                                    .map((b) => {
                                                        const bs = parseDbTime(b.start_time ?? null);
                                                        const be = parseDbTime(b.end_time ?? null);
                                                        if (!bs || !be) return null;

                                                        const dayOffset = (d?: Date | null) => {
                                                            if (!d || !baseDateObj) return 0;
                                                            return Math.round((d.getTime() - baseDateObj.getTime()) / 86400000);
                                                        };

                                                        const breakStartDate = parseDateOnly(b.start_time);
                                                        const bsMin = bs.hh * 60 + bs.mm + dayOffset(breakStartDate) * 1440;
                                                        const breakEndDate = parseDateOnly(b.end_time);
                                                        const beMinRaw = be.hh * 60 + be.mm + dayOffset(breakEndDate) * 1440;
                                                        const beMin = beMinRaw < bsMin ? beMinRaw + 1440 : beMinRaw;

                                                        const startColIndex = (bsMin - timelineStartMin) / interval;
                                                        const endColIndex = (beMin - timelineStartMin) / interval;
                                                        const colSpan = Math.max(0, endColIndex - startColIndex);
                                                        const leftPx = Math.max(0, startColIndex * columnWidth);
                                                        const widthPx = colSpan * columnWidth;
                                                        const breakStatus = b.status ?? 'scheduled';
                                                        const breakStyle: React.CSSProperties = {
                                                            left: `${leftPx}px`,
                                                            width: `${widthPx}px`,
                                                            zIndex: 5,
                                                        };

                                                        // 3. ステータスに応じてスタイルを決定します
                                                        if (breakStatus === 'actual') {
                                                            // 「実績」の場合：緑色で塗りつぶします
                                                            breakStyle.backgroundColor = 'rgba(34, 197, 94, 0.55)';
                                                        } else {
                                                            // 「予定」の場合：グレーの斜線模様にします
                                                            breakStyle.background = `repeating-linear-gradient(
                                                                45deg,
                                                                rgba(156, 163, 175, 0.4),
                                                                rgba(156, 163, 175, 0.4) 10px,
                                                                rgba(156, 163, 175, 0.5) 10px,
                                                                rgba(156, 163, 175, 0.5) 20px
                                                            )`;
                                                        }

                                                        return (
                                                            <div
                                                                key={`br-${b.id}`}
                                                                // 4. 見た目を整えるために、クラス名も少し変更しました
                                                                className={`absolute top-1 h-8 rounded-sm border border-gray-200/50`}
                                                                // 5. ここで、上で決定したスタイルを適用します
                                                                style={breakStyle}
                                                            />
                                                        );
                                                    })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex h-6 items-center">
                            <div
                                className="grid"
                                style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${columnWidth}px)`, minWidth: `${totalPixelWidth}px` }}
                            >
                                {attendanceCounts.map((c, i) => (
                                    <div key={`cnt-${i}`} className="h-6 border-l text-center text-sm font-medium">
                                        {c}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
