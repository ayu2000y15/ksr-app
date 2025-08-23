import { useMemo, useState } from 'react';

type BreakPayload = { shift_detail_id: number; start_time: string; end_time: string; type?: string };

type ShiftDetail = {
    id: number;
    start_time?: string | null;
    end_time?: string | null;
    date?: string | null;
    user_id?: number | null;
    user?: { id?: number; name?: string } | null;
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
    const { date, shiftDetails = [], initialInterval = 15, onBarClick, mode, breakType, onCreateBreak, breaks = [] } = props;

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

    const counts = useMemo(() => {
        const day = new Set<number>();
        const night = new Set<number>();
        (items || []).forEach((it: Item) => {
            const t = String(it.shift_type ?? it.type ?? '');
            const uid = Number(it.user_id ?? (it.user && (it.user as { id?: number }).id) ?? NaN);
            if (!Number.isFinite(uid)) return;
            if (t === 'day') day.add(uid);
            else if (t === 'night') night.add(uid);
        });

        // simple counts: just sizes of day/night sets (no break subtraction)
        return { dayCount: day.size, nightCount: night.size };
    }, [items]);

    // per-slot attendance counts = number of work shifts covering the slot minus any breaks overlapping the slot
    const attendanceCounts = useMemo(() => {
        const countsArr: number[] = Array(timeSlots.length).fill(0);

        if (!items || items.length === 0) return countsArr;

        // combine breaks from prop and any shiftDetails entries of type 'break'
        const sdBreaks = (shiftDetails || []).filter((s: ShiftDetail) => String(s.type ?? '') === 'break');
        const combinedBreaks = [
            ...(props.breaks || []),
            ...sdBreaks.map((s) => ({ id: s.id, shift_detail_id: s.id, start_time: s.start_time, end_time: s.end_time })),
        ];

        for (let idx = 0; idx < timeSlots.length; idx++) {
            const slotMin = timelineStartMin + idx * interval;
            const slotEndMin = slotMin + interval;

            // count work shifts covering this slot
            let workCount = 0;
            for (const it of items) {
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
    }, [items, shiftDetails, props.breaks, timelineStartMin, interval, timeSlots]);

    const displayDate = date ? String(date).slice(0, 10).replace(/-/g, '/') : '';

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
                <div className="flex items-center gap-3">
                    <label className="text-sm">グリッド間隔:</label>
                    <span className="rounded border bg-gray-50 p-1 text-sm">{String(initialInterval)}分</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                {/* Header/time ruler: use fixed wide columns only in break mode; keep original flexible grid for shift mode */}
                {mode === 'break' ? (
                    <div className="min-w-full">
                        <div className="flex items-stretch border-b">
                            <div className="w-28 sm:w-48" />
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
                    <div className="min-w-full">
                        <div className="flex items-stretch border-b">
                            <div className="w-28 sm:w-48" />
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
                )}

                <div className="mt-2 space-y-2">
                    {items.map((it: Item) => {
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
                                    <span className="mr-2 w-6 text-right font-mono text-sm">{it.user_id ?? (it.user && it.user.id) ?? '—'}</span>
                                    <span className="truncate">{it.user ? it.user.name : '—'}</span>
                                </div>

                                <div className="relative h-10 flex-1">
                                    <div
                                        className="absolute inset-0 bg-gray-50"
                                        style={mode === 'break' ? { minWidth: `${timeSlots.length * columnWidth}px` } : undefined}
                                    >
                                        {mode === 'break' && (
                                            <div className="grid" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${columnWidth}px)` }}>
                                                {timeSlots.map((t, idx) => {
                                                    const slotMin = timelineStartMin + idx * interval;
                                                    const within = slotMin >= sMin && slotMin <= eMin;
                                                    // determine if this slot already contains a break for this user
                                                    const sdBreaksLocal = (shiftDetails || []).filter(
                                                        (s: ShiftDetail) => String(s.type ?? '') === 'break',
                                                    );
                                                    const combinedBreaksLocal = [
                                                        ...(props.breaks || []),
                                                        ...sdBreaksLocal.map((s) => ({
                                                            id: s.id,
                                                            shift_detail_id: s.id,
                                                            user_id: s.user_id,
                                                            start_time: s.start_time,
                                                            end_time: s.end_time,
                                                        })),
                                                    ];
                                                    const isBreakSlot = combinedBreaksLocal
                                                        .filter((b: any) => Number(b.user_id) === Number(it.user_id))
                                                        .some((b: any) => {
                                                            const bs = parseDbTime(b.start_time ?? null);
                                                            const be = parseDbTime(b.end_time ?? null);
                                                            if (!bs || !be) return false;
                                                            const bsMin = bs.hh * 60 + bs.mm;
                                                            const beMin = be.hh * 60 + be.mm;
                                                            return bsMin < slotMin + interval && slotMin < beMin;
                                                        });
                                                    // block slot only when existing break AND selected breakType is not 'actual'
                                                    const slotBlocked = isBreakSlot && breakType !== 'actual';
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
                                        className={`absolute top-1 flex h-8 items-center overflow-hidden rounded ${mode === 'break' ? (it.shift_type === 'night' ? 'bg-indigo-200 text-indigo-800/60' : 'bg-yellow-200 text-yellow-900/60') : it.shift_type === 'night' ? 'bg-indigo-700/60 text-white' : 'bg-yellow-400/80 text-black'}`}
                                        style={
                                            mode === 'break'
                                                ? {
                                                      left: `${Math.max(0, barLeftPx)}px`,
                                                      width: `${Math.max(0, barWidthPx)}px`,
                                                      zIndex: 10,
                                                      pointerEvents: 'none',
                                                  }
                                                : { left: `${leftPercent}%`, width: `${widthPercent}%`, zIndex: 10, pointerEvents: 'auto' }
                                        }
                                        onClick={() => onBarClick && onBarClick(it.id)}
                                    >
                                        <div className="px-2 text-sm" style={{ cursor: onBarClick ? 'pointer' : undefined }}>
                                            {mode === 'break'
                                                ? ''
                                                : startLabel && endLabel
                                                  ? `${String(startLabel.hh).padStart(2, '0')}:${String(startLabel.mm).padStart(2, '0')} - ${String(endLabel.hh).padStart(2, '0')}:${String(endLabel.mm).padStart(2, '0')}`
                                                  : '時間未設定'}
                                        </div>

                                        {/* render breaks on bar (lighter color) */}
                                        {breaks &&
                                            breaks
                                                .filter((b: Break) => Number(b.shift_detail_id) === Number(it.id))
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
                        <div className="font-medium">出勤人数</div>
                        <div>
                            <span className="text-xs text-muted-foreground">昼 </span>
                            <span className="ml-1 font-medium text-yellow-800">{counts.dayCount}人</span>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">夜 </span>
                            <span className="ml-1 font-medium text-indigo-700">{counts.nightCount}人</span>
                        </div>
                    </div>

                    {/* per-slot attendance counts only visible in break mode */}
                    {mode === 'break' && (
                        <div className="mt-2">
                            <div className="flex items-center">
                                <div className="w-48" />
                                <div className="flex-1 overflow-x-auto">
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
