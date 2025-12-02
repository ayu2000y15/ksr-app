import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Car } from 'lucide-react';
import { useMemo } from 'react';

type CalendarDay = {
    date: string;
    is_past: boolean;
    is_today: boolean;
    shift_type: string | null;
    work_times: Array<{ start_time: string | null; end_time: string | null; status: string }>;
    break_times: Array<{ start_time: string | null; end_time: string | null }>;
    is_absent: boolean;
    has_transport_to?: boolean;
    has_transport_from?: boolean;
};

type Stats = {
    work_days: number;
    total_restraint_time: string;
    total_break_time: string;
    total_work_time: string;
    transport_to_count: number;
    transport_from_count: number;
};

export default function Show({
    user,
    properties,
    calendar,
    month,
    stats,
}: {
    user: any;
    properties: any[];
    calendar?: CalendarDay[];
    month?: string;
    stats?: Stats;
}) {
    let breadcrumbs = [{ title: 'ユーザー管理', href: route('users.index') }, { title: '詳細' }];

    const page = usePage();
    const auth = (page.props as any).auth ?? {};
    const permissions: string[] = auth?.permissions ?? [];
    const isSuperAdmin: boolean = auth?.isSuperAdmin ?? (page.props as any)['auth.isSuperAdmin'] ?? false;
    const canEdit = isSuperAdmin || (Array.isArray(permissions) && permissions.includes('user.update'));
    const canViewUsers = isSuperAdmin || (Array.isArray(permissions) && permissions.includes('user.view'));

    if (!canViewUsers) {
        breadcrumbs = [{ title: '詳細' }];
    }

    const weekdayMap = { Mon: '月', Tue: '火', Wed: '水', Thu: '木', Fri: '金', Sat: '土', Sun: '日' } as Record<string, string>;

    const preferredDays = Array.isArray(user.preferred_week_days)
        ? user.preferred_week_days
        : user.preferred_week_days
          ? JSON.parse(user.preferred_week_days)
          : [];

    // Ensure preferred days are displayed in Mon..Sun order (月,火,...日)
    const orderedWeekdayCodes = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const normalizeToCode = (v: any): string | null => {
        if (!v && v !== 0) return null;
        const s = String(v).trim();
        if (!s) return null;
        // already an English short code
        if (orderedWeekdayCodes.includes(s)) return s;
        // already a Japanese single-char day like '月'
        const foundKey = Object.keys(weekdayMap).find((k) => weekdayMap[k] === s);
        if (foundKey) return foundKey;
        // try English full name -> take first three letters
        const first3 = s.slice(0, 3);
        const cap = first3.charAt(0).toUpperCase() + first3.slice(1).toLowerCase();
        if (orderedWeekdayCodes.includes(cap)) return cap;
        return null;
    };

    const preferredDayCodes = Array.isArray(preferredDays)
        ? Array.from(new Set(preferredDays.map((d: any) => normalizeToCode(d)).filter((x: string | null): x is string => Boolean(x))))
        : [];

    const preferredDaysOrdered = orderedWeekdayCodes.filter((c) => preferredDayCodes.includes(c));

    // 月パラメータをパース
    const monthDate = useMemo(() => {
        if (!month) return new Date();
        const parts = String(month)
            .split('-')
            .map((p) => parseInt(p, 10));
        if (parts.length >= 2) return new Date(parts[0], parts[1] - 1, 1);
        return new Date(month);
    }, [month]);

    const formatMonthParam = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    };

    const prevMonth = () => {
        const m = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
        router.get(
            route('users.show', user.id),
            { month: formatMonthParam(m) },
            {
                only: ['calendar', 'month', 'stats'],
                preserveState: true,
            },
        );
    };

    const nextMonth = () => {
        const m = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
        router.get(
            route('users.show', user.id),
            { month: formatMonthParam(m) },
            {
                only: ['calendar', 'month', 'stats'],
                preserveState: true,
            },
        );
    };

    // 期間表示用（当月16日～翌月15日）
    const getPeriodDisplay = () => {
        const currentMonth = monthDate.getMonth() + 1;
        const currentYear = monthDate.getFullYear();
        const nextMonthNum = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
        return `${currentYear}/${currentMonth}/16 〜 ${nextYear}/${nextMonthNum}/15`;
    };

    const formatDate = (iso?: string | null) => {
        if (!iso) return '—';
        try {
            const s = String(iso).trim();
            // prefer simple yyyy-mm-dd -> yyyy/mm/dd
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return `${m[1]}/${m[2]}/${m[3]}`;
            // already in yyyy/mm/dd or other parseable form
            const d = new Date(s.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${y}/${mm}/${dd}`;
            }
            return s;
        } catch {
            return String(iso);
        }
    };

    const formatDateTime = (dt?: string | null) => {
        if (!dt) return '—';
        try {
            const s = String(dt).trim();
            // Parse yyyy-mm-dd hh:mm:ss format
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
            if (m) return `${m[4]}:${m[5]}`;
            // Try parsing as Date
            const d = new Date(s.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                return `${hh}:${mm}`;
            }
            return s;
        } catch {
            return String(dt);
        }
    };

    const formatDateWithWeekday = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const weekdayShort = d.toLocaleDateString('ja-JP', { weekday: 'short' });
            return `${year}/${month}/${day} (${weekdayShort})`;
        } catch {
            return dateStr;
        }
    };

    const getShiftTypeLabel = (shiftType: string | null) => {
        if (!shiftType) return '—';
        switch (shiftType) {
            case 'day':
                return '昼';
            case 'night':
                return '夜';
            case 'leave':
                return '休';
            default:
                return shiftType;
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={`ユーザー: ${user.name}`} />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-lg font-medium">ユーザー詳細</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => window.history.back()} title="前のページへ戻る">
                            戻る
                        </Button>
                        {canEdit ? (
                            <Link href={route('users.edit', user.id)}>
                                <Button>編集</Button>
                            </Link>
                        ) : null}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {user.name} (ID: {user.position ?? user.id})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                                <div className="text-sm text-muted-foreground">採用条件</div>
                                <div className="font-medium">
                                    {user.employment_condition === 'dormitory' ? '寮' : user.employment_condition === 'commute' ? '通勤' : '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">通勤方法</div>
                                <div className="font-medium">{user.commute_method || '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">基本出勤時間</div>
                                <div className="font-medium">
                                    {user.default_start_time || '—'} 〜 {user.default_end_time || '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">週休希望日数</div>
                                <div className="font-medium">{user.preferred_week_days_count ?? '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">固定休希望</div>
                                <div className="font-medium">
                                    {preferredDaysOrdered.length > 0 ? preferredDaysOrdered.map((d) => weekdayMap[d] || d).join(' ') : '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">勤務期間</div>
                                <div className="font-medium">{user.employment_period || '—'}</div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <div className="text-sm text-muted-foreground">勤務備考</div>
                                <div className="whitespace-pre-line">{user.employment_notes || '—'}</div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <div className="text-sm text-muted-foreground">メモ</div>
                                <div className="whitespace-pre-line">{user.memo || '—'}</div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="text-sm font-medium">関連物件</div>
                            {properties && properties.length > 0 ? (
                                properties.map((p: unknown) => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const prop = p as any; // minimal cast for render
                                    return (
                                        <div key={prop.property.id} className="mt-3 rounded border p-3">
                                            <div className="font-medium">{prop.property.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                不動産会社: {prop.property.real_estate_agent ? prop.property.real_estate_agent.name : '—'}
                                            </div>
                                            <div className="text-sm">郵便番号: {prop.property.postcode || '—'}</div>
                                            <div className="text-sm">住所: {prop.property.address || '—'}</div>
                                            <div className="text-sm">駐車場: {prop.property.has_parking ? 'あり' : 'なし'}</div>

                                            <div className="mt-2 text-sm font-medium">入居情報</div>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {prop.occupancies.map((occ: any) => (
                                                <div key={occ.id} className="mt-1 ml-2">
                                                    <div>入寮日: {formatDate(occ.move_in_date)}</div>
                                                    <div>退寮日: {occ.move_out_date ? formatDate(occ.move_out_date) : '—'}</div>
                                                    {occ.cohabitants && occ.cohabitants.length > 0 ? (
                                                        <div className="mt-2">
                                                            <div className="text-sm text-muted-foreground">同居ユーザー</div>
                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                {occ.cohabitants.map((c: any) => (
                                                                    <Badge
                                                                        key={c.id}
                                                                        className="inline-flex items-center gap-2 bg-gray-200 text-black"
                                                                    >
                                                                        {c.name}
                                                                        {c.has_car ? <Car className="h-3 w-3 text-violet-600" /> : null}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="mt-2 text-sm text-muted-foreground">該当物件なし</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 出勤履歴 */}
                {calendar && calendar.length > 0 && (
                    <Card className="mt-6">
                        <CardTitle className="px-6">出勤履歴・シフト情報</CardTitle>
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
                                <div className="mt-1 text-sm font-normal text-muted-foreground">{getPeriodDisplay()}</div>
                            </div>
                            <div className="flex-shrink-0">
                                <Button size="sm" onClick={nextMonth}>
                                    次の月
                                </Button>
                            </div>
                        </CardHeader>
                        {stats && (
                            <>
                                <div className="border-t bg-gray-50 px-6 py-4">
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                                        <div>
                                            <div className="text-xs text-muted-foreground">出勤日数</div>
                                            <div className="text-lg font-semibold">{stats.work_days}日</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">総拘束時間</div>
                                            <div className="text-lg font-semibold">{stats.total_restraint_time}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">総休憩時間</div>
                                            <div className="text-lg font-semibold">{stats.total_break_time}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">総稼働時間</div>
                                            <div className="text-lg font-semibold">{stats.total_work_time}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">送迎（行き）</div>
                                            <div className="text-lg font-semibold">{stats.transport_to_count}回</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">送迎（帰り）</div>
                                            <div className="text-lg font-semibold">{stats.transport_from_count}回</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t bg-blue-50 px-6 py-3">
                                    <div className="text-xs text-muted-foreground">
                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-1">
                                                <Car className="h-4 w-4 text-blue-600" />
                                                <span>送迎（行き）</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Car className="h-4 w-4 text-orange-600" />
                                                <span>送迎（帰り）</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        <CardContent className="max-h-[70vh] overflow-y-auto">
                            <div className="flex flex-col">
                                {calendar.map((day) => {
                                    // デバッグ: 送迎フラグを確認
                                    if (day.has_transport_to || day.has_transport_from) {
                                        console.log('Transport detected:', {
                                            date: day.date,
                                            has_transport_to: day.has_transport_to,
                                            has_transport_from: day.has_transport_from,
                                        });
                                    }

                                    const isLeave = day.shift_type === 'leave';
                                    const hasWork = day.work_times && day.work_times.length > 0;

                                    // 日付オブジェクトを作成して曜日を判定
                                    const dateObj = new Date(day.date);
                                    const dayIndex = dateObj.getDay();
                                    const isWeekend = dayIndex === 0 || dayIndex === 6;

                                    // 背景色を曜日に基づいて設定
                                    let rowBg = '';
                                    if (day.is_today) {
                                        rowBg = 'bg-green-100';
                                    } else if (dayIndex === 0 || isLeave) {
                                        // 日曜日または休日
                                        rowBg = 'bg-red-50';
                                    } else if (dayIndex === 6) {
                                        // 土曜日
                                        rowBg = 'bg-blue-50';
                                    }

                                    // 日付テキストの色
                                    const dateTextClass = dayIndex === 0 || isLeave ? 'text-red-600' : dayIndex === 6 ? 'text-blue-600' : '';

                                    // 時刻文字列を作成
                                    const timeStr =
                                        hasWork && day.work_times[0]
                                            ? `${formatDateTime(day.work_times[0].start_time)}〜${formatDateTime(day.work_times[0].end_time)}`
                                            : null;

                                    return (
                                        <div key={day.date} className={`border-b px-2 py-3 sm:px-4 ${rowBg}`}>
                                            {/* Mobile layout */}
                                            <div className="flex flex-col gap-2 md:hidden">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className={`font-medium ${dateTextClass}`}>
                                                            {(() => {
                                                                const d = new Date(day.date);
                                                                const m = d.getMonth() + 1;
                                                                const dd = d.getDate();
                                                                const jp = ['日', '月', '火', '水', '木', '金', '土'];
                                                                return `${m}/${dd} (${jp[d.getDay()]})`;
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isLeave && (
                                                            <div className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                                休
                                                            </div>
                                                        )}
                                                        {day.is_absent && (
                                                            <Badge variant="destructive" className="text-xs">
                                                                欠席
                                                            </Badge>
                                                        )}
                                                        {day.has_transport_to && <Car className="h-4 w-4 text-blue-600" title="送迎（行き）" />}
                                                        {day.has_transport_from && <Car className="h-4 w-4 text-orange-600" title="送迎（帰り）" />}
                                                    </div>
                                                </div>
                                                {timeStr && (
                                                    <div
                                                        className={`text-xs ${day.is_past && !day.is_today ? 'text-muted-foreground' : 'font-medium text-sky-700'}`}
                                                    >
                                                        {timeStr}
                                                    </div>
                                                )}
                                                {!hasWork && !isLeave && (
                                                    <div className="text-xs text-muted-foreground">{day.is_past ? '勤務なし' : '予定なし'}</div>
                                                )}
                                                {day.break_times && day.break_times.length > 0 && (
                                                    <div className="mt-1 space-y-1">
                                                        {day.break_times.map((br, idx) => (
                                                            <div key={idx} className="text-xs text-muted-foreground">
                                                                休憩: {formatDateTime(br.start_time)} 〜 {formatDateTime(br.end_time)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Desktop layout */}
                                            <div className="hidden md:grid md:grid-cols-[80px_50px_1fr_auto] md:items-center md:gap-4">
                                                {/* 日付列 */}
                                                <div className={`font-medium ${dateTextClass}`}>
                                                    {(() => {
                                                        const d = new Date(day.date);
                                                        const m = d.getMonth() + 1;
                                                        const dd = d.getDate();
                                                        const jp = ['日', '月', '火', '水', '木', '金', '土'];
                                                        return `${m}/${dd} (${jp[d.getDay()]})`;
                                                    })()}
                                                </div>

                                                {/* 送迎列 */}
                                                <div className="flex items-center gap-2">
                                                    {day.has_transport_to && <Car className="h-4 w-4 text-blue-600" title="送迎（行き）" />}
                                                    {day.has_transport_from && <Car className="h-4 w-4 text-orange-600" title="送迎（帰り）" />}
                                                </div>

                                                {/* 勤務時間列 */}
                                                <div className="flex items-center gap-2">
                                                    {isLeave && (
                                                        <div className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                            休
                                                        </div>
                                                    )}
                                                    {day.is_absent && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            欠席
                                                        </Badge>
                                                    )}
                                                    {timeStr && (
                                                        <div
                                                            className={`text-sm ${day.is_past && !day.is_today ? 'text-muted-foreground' : 'font-medium text-sky-700'}`}
                                                        >
                                                            {timeStr}
                                                        </div>
                                                    )}
                                                    {!hasWork && !isLeave && (
                                                        <div className="text-sm text-muted-foreground">{day.is_past ? '勤務なし' : '予定なし'}</div>
                                                    )}
                                                </div>

                                                {/* 休憩時間列 */}
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    {day.break_times && day.break_times.length > 0 && (
                                                        <>
                                                            {day.break_times.map((br, idx) => (
                                                                <span key={idx}>
                                                                    休憩: {formatDateTime(br.start_time)}〜{formatDateTime(br.end_time)}
                                                                </span>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppSidebarLayout>
    );
}
