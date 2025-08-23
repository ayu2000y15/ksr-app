import { useMemo, useState } from 'react';

export default function DailyTimeline({
    date,
    shiftDetails = [],
    initialInterval = 15,
    onBarClick,
}: {
    date: string;
    shiftDetails?: any[];
    initialInterval?: number;
    onBarClick?: (id: number) => void;
}) {
    const [interval, setInterval] = useState<number>(initialInterval);

    // include shifts whose interval overlaps the selected date window
    const items = useMemo(() => {
        if (!date) return [];

        // parse YYYY-MM-DD into local Date midnight safely
        const parseLocalDay = (iso: string) => {
            const parts = iso.split('-').map((p) => parseInt(p, 10));
            if (parts.length < 3 || parts.some(isNaN)) return null;
            return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
        };

        const dayStart = parseLocalDay(date);
        if (!dayStart) return [];
        const dayEnd = new Date(dayStart.getTime());
        dayEnd.setHours(23, 59, 59, 999);

        // Parse DB datetime string into components (date + hh/mm/ss) without applying client TZ.
        // This preserves the DB wall-clock time so UI shows exactly what's stored.
        const parseDbDateTimeParts = (dt?: string | null) => {
            if (!dt) return null;
            const s = String(dt).trim();
            // match YYYY-MM-DD HH:MM:SS or YYYY/MM/DD HH:MM:SS
            const m = s.match(/(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
            if (!m) return null;
            return {
                year: Number(m[1]),
                month: Number(m[2]),
                day: Number(m[3]),
                hour: Number(m[4]),
                minute: Number(m[5]),
                second: m[6] ? Number(m[6]) : 0,
            };
        };

        // Filter by start date only: include items whose start_time's date equals `date`.
        const filtered = (shiftDetails || []).filter((sd: any) => {
            try {
                if (sd.start_time) {
                    // compare raw DB string prefix (YYYY-MM-DD) to selected date
                    const s = String(sd.start_time);
                    return s.startsWith(date);
                }
                // If no start_time, fall back to `date` column (YYYY-MM-DD prefix match)
                if (sd.date) {
                    return String(sd.date).startsWith(date);
                }
                return false;
            } catch {
                return false;
            }
        });

        const mapped = filtered.map((sd: any) => {
            // compute minutes from midnight directly from DB strings to avoid TZ shifts
            const startParts = sd.start_time ? parseDbDateTimeParts(sd.start_time) : null;
            const endParts = sd.end_time ? parseDbDateTimeParts(sd.end_time) : null;
            let sMin = null as number | null;
            if (startParts) sMin = startParts.hour * 60 + startParts.minute;
            let eMin = null as number | null;
            if (endParts) {
                // treat 24:00 as 1440 minutes (end of day)
                if (endParts.hour === 24) {
                    eMin = 24 * 60;
                } else {
                    eMin = endParts.hour * 60 + endParts.minute;
                }
            }
            if (endParts && startParts) {
                // if end is on a later date than start (cross-midnight), or end time is earlier, add 24h
                if (
                    endParts.year > startParts.year ||
                    endParts.month > startParts.month ||
                    endParts.day > startParts.day ||
                    (eMin !== null && sMin !== null && eMin < sMin)
                ) {
                    eMin = (eMin ?? 0) + 24 * 60;
                }
            }
            // keep raw strings for labels; don't create Date objects that shift with TZ
            return { ...sd, startRaw: sd.start_time ?? null, endRaw: sd.end_time ?? null, sMin, eMin };
        });

        // sort: day shifts first, then by user_id asc, then by start minutes asc
        const rank = (sd: any) => {
            const t = (sd.shift_type || sd.type || '').toString();
            if (t === 'day') return 0;
            if (t === 'night') return 2;
            return 1;
        };

        mapped.sort((a: any, b: any) => {
            const ra = rank(a);
            const rb = rank(b);
            if (ra !== rb) return ra - rb;
            const aUid = Number(a.user_id ?? (a.user && a.user.id) ?? 0);
            const bUid = Number(b.user_id ?? (b.user && b.user.id) ?? 0);
            if (aUid !== bUid) return aUid - bUid;
            const aS = a.sMin === null || a.sMin === undefined ? Number.MAX_SAFE_INTEGER : a.sMin;
            const bS = b.sMin === null || b.sMin === undefined ? Number.MAX_SAFE_INTEGER : b.sMin;
            return aS - bS;
        });

        return mapped;
    }, [shiftDetails, date]);

    // compute timeline window: earliest start -1h, latest end +2h, clamp to 0..1440
    const [timelineStartMin, timelineEndMin] = useMemo(() => {
        if (!items || items.length === 0) return [9 * 60, 18 * 60];
        const starts = items.map((it: any) => it.sMin).filter((v: any) => v !== null) as number[];
        const ends = items.map((it: any) => it.eMin).filter((v: any) => v !== null) as number[];
        const minStart = Math.min(...starts);
        const maxEnd = Math.max(...ends);
        const start = Math.max(0, minStart - 60);
        // Allow end to extend past midnight so cross-midnight shifts are fully visible on start date
        const end = maxEnd + 120;
        // ensure at least 2 hours window
        if (end - start < 60 * 2) return [Math.max(0, start - 60), Math.min(24 * 60, end + 60)];
        return [start, end];
    }, [items]);

    const totalMinutes = timelineEndMin - timelineStartMin;
    const stepCount = Math.ceil(totalMinutes / interval);

    const timeSlots = Array.from({ length: stepCount + 1 }, (_, i) => timelineStartMin + i * interval);

    const formatHM = (m: number) => {
        const hh = Math.floor(m / 60) % 24;
        const mm = m % 60;
        return `${hh}:${String(mm).padStart(2, '0')}`;
    };

    // compute unique user counts for day/night shifts (unique by user_id)
    const counts = useMemo(() => {
        const daySet = new Set<number>();
        const nightSet = new Set<number>();
        (items || []).forEach((it: any) => {
            try {
                const t = (it.shift_type || it.type || '').toString();
                const uid = Number(it.user_id ?? (it.user && it.user.id) ?? NaN);
                if (!Number.isFinite(uid)) return;
                if (t === 'day') daySet.add(uid);
                else if (t === 'night') nightSet.add(uid);
            } catch (e) {
                // ignore
            }
        });
        return { dayCount: daySet.size, nightCount: nightSet.size };
    }, [items]);

    const displayDate = date ? String(date).slice(0, 10).replace(/-/g, '/') : '';

    return (
        <div className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-medium">{displayDate}</div>
                <div className="flex items-center gap-3">
                    <label className="text-sm">グリッド間隔:</label>
                    <select value={String(interval)} onChange={(e) => setInterval(Number(e.target.value))} className="rounded border p-1 text-sm">
                        <option value="5">5分</option>
                        <option value="15">15分</option>
                        <option value="30">30分</option>
                        <option value="60">60分</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-full">
                    {/* header timeline labels */}
                    <div className="flex items-stretch border-b">
                        <div className="w-48" />
                        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))` }}>
                            {timeSlots.map((t, i) => {
                                const absolute = timelineStartMin + i * interval;
                                const wall = ((absolute % (24 * 60)) + 24 * 60) % (24 * 60);
                                const label = wall % 60 === 0 ? String(Math.floor(wall / 60)) : '';
                                return (
                                    <div key={t + ':' + i} className="border-l py-1 text-center text-xs text-muted-foreground">
                                        {label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* items */}
                    <div className="mt-2 space-y-2">
                        {items.map((it: any) => {
                            if (it.sMin === null || it.eMin === null) return null;
                            const rawLeft = ((it.sMin - timelineStartMin) / totalMinutes) * 100;
                            const rawWidth = ((it.eMin - it.sMin) / totalMinutes) * 100;
                            // clamp and ensure reasonable minimum width so 24:00 end shows
                            const leftPercent = Number.isFinite(rawLeft) ? Math.max(0, Math.min(100, rawLeft)) : 0;
                            let widthPercent = Number.isFinite(rawWidth) ? Math.max(0, rawWidth) : 0;
                            // prevent bars from collapsing to 0 width; limit to available space
                            const maxAvailable = Math.max(0, 100 - leftPercent);
                            const minWidth = Math.min(0.5, maxAvailable); // 0.5% min or available
                            if (widthPercent < minWidth) widthPercent = Math.min(minWidth, maxAvailable);
                            widthPercent = Math.min(widthPercent, maxAvailable);

                            // derive label times from raw DB strings to avoid TZ conversion
                            const parseLabelFromRaw = (raw?: string | null) => {
                                if (!raw) return null;
                                const m = String(raw).match(/(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
                                if (!m) return null;
                                const hh = Number(m[4]);
                                const mm = Number(m[5]);
                                return `${hh}:${String(mm).padStart(2, '0')}`;
                            };

                            const startLabel = parseLabelFromRaw(it.startRaw);
                            const endLabel = parseLabelFromRaw(it.endRaw);

                            return (
                                <div key={it.id} className="flex items-center gap-4">
                                    <div className="w-48 font-medium flex items-center">
                                        <span className="font-mono text-sm w-6 text-right mr-2">{it.user_id ?? (it.user && it.user.id) ?? '—'}</span>
                                        <span className="truncate">{it.user ? it.user.name : '—'}</span>
                                    </div>
                                    <div className="relative h-10 flex-1">
                                        <div className="absolute inset-0 bg-gray-50">
                                            {/* grid lines */}
                                            <div
                                                className="pointer-events-none absolute inset-0 grid"
                                                style={{ gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))` }}
                                            >
                                                {timeSlots.map((t) => (
                                                    <div key={t} className="border-l" />
                                                ))}
                                            </div>
                                        </div>
                                        <div
                                            className={`absolute top-1 flex h-8 items-center overflow-hidden rounded ${(() => {
                                                const st = it.shift_type || it.type || '';
                                                if (st === 'night') return 'bg-indigo-700/60 text-white';
                                                if (st === 'day') return 'bg-yellow-400/80 text-black';
                                                return 'bg-yellow-400/80 text-black';
                                            })()}`}
                                            style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, zIndex: 10, pointerEvents: 'auto' }}
                                            role={onBarClick ? 'button' : undefined}
                                            tabIndex={onBarClick ? 0 : undefined}
                                            onClick={() => onBarClick && onBarClick(it.id)}
                                            onKeyDown={(e) => {
                                                if (!onBarClick) return;
                                                if (e.key === 'Enter' || e.key === ' ') onBarClick(it.id);
                                            }}
                                        >
                                            <div className="px-2 text-sm" style={{ cursor: onBarClick ? 'pointer' : undefined }}>
                                                {startLabel && endLabel ? `${startLabel} - ${endLabel}` : '時間未設定'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* footer: staff counts */}
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
                    </div>

                    {items.length === 0 && <div className="mt-4 text-sm text-muted-foreground">この日の勤務詳細はありません。</div>}
                </div>
            </div>
        </div>
    );
}
