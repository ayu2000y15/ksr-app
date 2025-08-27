// @ts-nocheck
import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox';
import Toast from '@/components/ui/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Car, ChevronLeft, ChevronRight, Flag, Plus, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function formatDate(d: Date) {
    // Format using local date components to avoid UTC conversion shifting the date
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatMonthDay(d: string) {
    // d is expected as 'YYYY-MM-DD' — convert to m/d without leading zeros
    const parts = d.split('-');
    if (parts.length < 3) return d;
    const m = Number(parts[1]);
    const day = Number(parts[2]);
    return `${m}/${day}`;
}

export default function Index({ properties }: any) {
    const page = usePage();
    // permissions shared via SharePermissions middleware: page.props.permissions.properties
    const permProps = (page.props && page.props.permissions && page.props.permissions.properties) || {};
    const canCreate = !!permProps.create;
    const canEdit = !!permProps.update; // middleware maps properties.edit -> update
    const canDelete = !!permProps.delete;

    const safeRoute = (name: string, fallback: string) => {
        try {
            // @ts-expect-error route may be injected globally by Ziggy
            return typeof route === 'function' ? route(name) : fallback;
        } catch {
            return fallback;
        }
    };

    // current shown month state (Date pinned to first day of month)
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // build date range from currentMonth
    const { startDate, endDate, days } = useMemo(() => {
        const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const daysArr: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            daysArr.push(formatDate(new Date(d)));
        }
        return { startDate: formatDate(start), endDate: formatDate(end), days: daysArr };
    }, [currentMonth]);

    const gotoPrevMonth = () => {
        setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    };
    const gotoNextMonth = () => {
        setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    };

    // normalize room occupancies into ranges
    const normalizeRows = (propsList: any[]) =>
        (propsList || []).map((p: any) => {
            const occs = (p.room_occupancies || []).map((o: any) => {
                // determine user display name(s)
                const user_name = o.user ? o.user.name : o.user_name ? o.user_name : o.user_id ? `user:${o.user_id}` : '';
                const user_ids = Array.isArray(o.user_ids) ? o.user_ids : o.user_id ? [o.user_id] : [];
                const user_names = Array.isArray(o.user_names)
                    ? o.user_names
                    : user_name
                      ? [user_name]
                      : user_ids.length > 0
                        ? user_ids.map((id: any) => `user:${id}`)
                        : [];

                // derive move_out_confirm fields from any available source (new names or legacy checkout_* names)
                const move_out_confirm_user_name =
                    o.move_out_confirm_user_name ||
                    (o.move_out_confirm_user && o.move_out_confirm_user.name) ||
                    (o.checkout_user && o.checkout_user.name) ||
                    (o.checkout_user_name ? o.checkout_user_name : '') ||
                    '';

                const move_out_confirm_date = o.move_out_confirm_date || o.checkout_date || '';

                return {
                    id: o.id,
                    user_name,
                    user_ids,
                    user_names,
                    start: o.move_in_date,
                    // if move_out_date is empty, use visible endDate for layout but mark as open-ended
                    end: o.move_out_date || endDate,
                    open_ended: !o.move_out_date,
                    move_out_confirm_user_name,
                    move_out_confirm_date,
                    // expose confirmer id and original checkout_user object (if present) so click-to-edit can populate the select
                    move_out_confirm_user_id: o.move_out_confirm_user_id ?? o.checkout_user_id ?? null,
                    checkout_user: o.checkout_user || undefined,
                    checkout_user_id: o.checkout_user_id ?? null,
                };
            });
            return { property: p, occs };
        });

    const [rowsState, setRowsState] = useState(() => normalizeRows(properties || []));
    useEffect(() => {
        setRowsState(normalizeRows(properties || []));
    }, [properties, endDate]);

    // tooltip open state for touch devices (tap to open)
    const [openTooltipId, setOpenTooltipId] = useState<number | null>(null);
    const [isTouch, setIsTouch] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const m = window.matchMedia('(hover: none) and (pointer: coarse)');
        const set = () => setIsTouch(!!m.matches);
        set();
        try {
            m.addEventListener('change', set);
            return () => m.removeEventListener('change', set);
        } catch {
            // older browsers
            m.addListener(set);
            return () => m.removeListener(set);
        }
    }, []);

    // timeline cell width (px) and total timeline width
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const m = window.matchMedia('(max-width: 640px)');
        const onChange = () => setIsSmallScreen(!!m.matches);
        onChange();
        try {
            m.addEventListener('change', onChange);
            return () => m.removeEventListener('change', onChange);
        } catch {
            m.addListener(onChange);
            return () => m.removeListener(onChange);
        }
    }, []);

    const cellWidth = isSmallScreen ? 34 : 42; // smaller cell on mobile
    const timelineWidth = days.length * cellWidth;

    // 入寮者登録フォーム状態
    const [showMoveInForm, setShowMoveInForm] = useState(false);
    const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
    const [allUsersMap, setAllUsersMap] = useState<Record<number, string>>({});
    const [form, setForm] = useState<any>({
        id: null,
        property_id: '',
        user_ids: [] as number[],
        move_in_date: new Date().toISOString().slice(0, 10),
        move_out_date: '',
        move_out_confirm_user_id: '',
        move_out_confirm_date: '',
    });
    const resetForm = () => {
        setErrors({});
        setForm({
            id: null,
            property_id: '',
            user_ids: [],
            move_in_date: new Date().toISOString().slice(0, 10),
            move_out_date: '',
            move_out_confirm_user_id: '',
            move_out_confirm_date: '',
        });
    };
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // properties prop may already be sorted by server; server now provides `display_label` for selects
    const propertyOptions = (properties || []).map((p: any) => ({ value: p.id, label: p.display_label ?? p.name }));

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/active-users');
            setUsers(res.data.users || []);
        } catch {
            // fallback: empty
            setUsers([]);
        }
    };

    // fetch full user list mapping (id => name) to resolve names for occupancies
    const fetchAllUsersMap = async () => {
        try {
            const res = await axios.get('/api/users');
            const list = res.data || [];
            const map: Record<number, string> = {};
            list.forEach((u: any) => {
                if (u && u.id != null) map[u.id] = u.name || '';
            });
            setAllUsersMap(map);
        } catch {
            setAllUsersMap({});
        }
    };

    useEffect(() => {
        // preload users when form shown
        if (showMoveInForm) fetchUsers();
        // always try to fetch all users map once so tooltips can resolve names
        fetchAllUsersMap();
    }, [showMoveInForm]);

    const renderFieldError = (field: string) => {
        const arr = errors[field] as string[] | undefined;
        if (!arr || arr.length === 0) return null;
        return <div className="text-sm text-red-600">{arr.join(' ')}</div>;
    };

    const handleSubmitMoveIn = async () => {
        setErrors({});
        // client-side required checks
        const e: Record<string, string[]> = {};
        if (!form.property_id) e.property_id = ['物件を選択してください'];
        if (!form.user_ids || form.user_ids.length === 0) e.user_ids = ['ユーザーを選択してください'];
        if (!form.move_in_date) e.move_in_date = ['入寮日を入力してください'];
        // ensure move_out_date (if provided) is not before move_in_date
        if (form.move_out_date) {
            const mi = new Date(form.move_in_date);
            const mo = new Date(form.move_out_date);
            if (mo < mi) {
                e.move_out_date = ['退寮日は入寮日以降の日付を選択してください'];
            }
        }
        // ensure move_out_confirm_date (if provided) is not before move_out_date (when move_out_date exists)
        if (form.move_out_confirm_date && form.move_out_date) {
            const mo = new Date(form.move_out_date);
            const mc = new Date(form.move_out_confirm_date);
            if (mc < mo) {
                e.move_out_confirm_date = ['退去確認日は退寮日以降の日付を選択してください'];
            }
        }
        if (Object.keys(e).length > 0) {
            setErrors(e);
            return;
        }

        try {
            // ensure user_ids is an array of numbers (Laravel expects array with at least one element)
            const userIds = Array.isArray(form.user_ids)
                ? form.user_ids.map((v) => (typeof v === 'string' ? Number(v) : v)).filter((v) => v != null && v !== '')
                : form.user_ids
                  ? [Number(form.user_ids)]
                  : [];

            const payload: Record<string, unknown> = {
                property_id: form.property_id,
                user_ids: userIds,
                move_in_date: form.move_in_date,
                move_out_date: form.move_out_date || null,
                move_out_confirm_user_id:
                    form.move_out_confirm_user_id && typeof form.move_out_confirm_user_id === 'object'
                        ? Number((form.move_out_confirm_user_id as any).value)
                        : form.move_out_confirm_user_id || null,
                move_out_confirm_date: form.move_out_confirm_date || null,
            };
            if (form.id) payload.id = form.id;

            const resp = await axios.post('/api/room-occupancies', payload);
            // server returns created/updated occupancy in resp.data.room_occupancy
            const occ = resp.data && resp.data.room_occupancy ? resp.data.room_occupancy : null;
            // update local rowsState to reflect change without full reload
            if (occ) {
                setRowsState((prev) => {
                    const next = prev.map((r) => {
                        if (r.property.id !== Number(payload.property_id)) return r;
                        // build normalized occ object similar to normalizeRows
                        const cid = occ.move_out_confirm_user_id ?? occ.checkout_user_id ?? null;
                        const normalized = {
                            id: occ.id,
                            user_ids: Array.isArray(occ.user_ids) ? occ.user_ids : occ.user_id ? [occ.user_id] : [],
                            user_names: occ.user_names || undefined,
                            user_name: occ.user_name || undefined,
                            start: occ.move_in_date,
                            end: occ.move_out_date || endDate,
                            open_ended: !occ.move_out_date,
                            // ensure confirmer id and name (resolve from checkout_user or allUsersMap if necessary)
                            move_out_confirm_user_id: cid,
                            move_out_confirm_user_name:
                                occ.move_out_confirm_user_name ||
                                (occ.checkout_user && occ.checkout_user.name) ||
                                (cid ? allUsersMap[cid as number] : undefined) ||
                                undefined,
                            move_out_confirm_date: occ.move_out_confirm_date || occ.checkout_date || undefined,
                            // ensure checkout_user object exists (fallback to id+name from allUsersMap)
                            checkout_user: occ.checkout_user || (cid ? { id: cid, name: allUsersMap[cid as number] || '' } : undefined),
                            checkout_user_id: occ.checkout_user_id ?? cid ?? null,
                        };

                        // if updating existing occ, replace it; otherwise append
                        const existsIdx = r.occs.findIndex((x: { id?: number }) => x.id === occ.id);
                        const newOccs = [...r.occs];
                        if (existsIdx >= 0) {
                            newOccs[existsIdx] = normalized;
                        } else {
                            newOccs.push(normalized);
                        }
                        return { ...r, occs: newOccs };
                    });
                    return next;
                });
            }
            setToast({ message: form.id ? '入寮者を更新しました' : '入寮者を登録しました', type: 'success' });
            // reset
            setForm({
                id: null,
                property_id: '',
                user_ids: [],
                move_in_date: new Date().toISOString().slice(0, 10),
                move_out_date: '',
                move_out_confirm_user_id: '',
                move_out_confirm_date: '',
            });
            setShowMoveInForm(false);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response && err.response.status === 422) {
                const data = err.response.data as unknown as Record<string, unknown>;
                const errs = data.errors as unknown as Record<string, string[]> | undefined;
                setErrors(errs || {});
            } else {
                setToast({ message: '登録に失敗しました', type: 'error' });
            }
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={[{ title: '物件管理', href: route('properties.index') }]}>
            <Head title="物件管理" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6 flex flex-nowrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <div>
                                <HeadingSmall title="物件管理（入退寮）" description={`表示期間: ${startDate} 〜 ${endDate}`} />
                                <div className="mt-2 flex items-center gap-2">
                                    <Button size="sm" onClick={gotoPrevMonth} aria-label="前月">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="text-sm font-medium">
                                        {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                                    </div>
                                    <Button size="sm" onClick={gotoNextMonth} aria-label="次月">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-nowrap items-center justify-end gap-2">
                        <Link href={safeRoute('properties.masters.properties.index', '/properties/masters/properties')}>
                            <Button size="sm" variant="ghost" className="whitespace-nowrap">
                                物件マスタ管理
                            </Button>
                        </Link>
                        <Button
                            className="whitespace-nowrap"
                            onClick={() => {
                                if (!canCreate) return; // no-op if user lacks create permission
                                // if already open, close; if opening, reset form so edit data is cleared
                                if (showMoveInForm) {
                                    setShowMoveInForm(false);
                                } else {
                                    resetForm();
                                    setShowMoveInForm(true);
                                }
                            }}
                            disabled={!canCreate}
                        >
                            <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                            {/* モバイルはアイコンのみ、sm以上でテキスト表示 */}
                            <span className="hidden sm:inline">入寮者登録</span>
                        </Button>
                    </div>
                </div>

                {showMoveInForm && (
                    <div className="mb-6 flex justify-center">
                        <div className="w-full lg:w-2/3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>入寮者登録</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 md:grid md:gap-4 md:space-y-0">
                                        <div>
                                            <Label>
                                                物件名 <span className="text-red-600">*</span>
                                            </Label>
                                            <SingleSelectCombobox
                                                options={propertyOptions}
                                                selected={form.property_id || null}
                                                onChange={(val) => {
                                                    const unknownVal = val as unknown;
                                                    let v: number | string | null | '' = '';
                                                    if (unknownVal && typeof unknownVal === 'object') {
                                                        v = (unknownVal as { value?: number | string }).value ?? '';
                                                    } else {
                                                        v = (unknownVal as number | string | null) ?? '';
                                                    }
                                                    setForm({ ...form, property_id: v !== '' && v != null ? Number(v) : '' });
                                                }}
                                            />
                                            {renderFieldError('property_id')}
                                        </div>

                                        <div>
                                            <Label>
                                                ユーザー名 <span className="text-red-600">*</span>
                                            </Label>
                                            <MultiSelectCombobox
                                                options={users.map((u) => ({ value: u.id, label: `${u.id} ${u.name}` }))}
                                                selected={form.user_ids}
                                                onChange={(vals) => setForm({ ...form, user_ids: vals })}
                                            />
                                            {renderFieldError('user_ids')}
                                        </div>

                                        <div>
                                            <Label>
                                                入寮日 <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                type="date"
                                                value={form.move_in_date}
                                                onChange={(e) => setForm({ ...form, move_in_date: e.target.value })}
                                            />
                                            {renderFieldError('move_in_date')}
                                        </div>

                                        <div>
                                            <Label>退寮日</Label>
                                            <Input
                                                type="date"
                                                value={form.move_out_date}
                                                min={form.move_in_date || undefined}
                                                onChange={(e) => setForm({ ...form, move_out_date: e.target.value })}
                                            />
                                            {renderFieldError('move_out_date')}
                                        </div>

                                        <div>
                                            <Label>退去確認者</Label>
                                            {(() => {
                                                // ensure the selected confirmer id is present in the options so the label shows immediately
                                                const baseOptions = users.map((u) => ({ value: u.id, label: `${u.id} ${u.name}` }));
                                                const selectedCid = form.move_out_confirm_user_id || '';
                                                let confirmOptions = baseOptions;
                                                if (selectedCid && !baseOptions.find((o) => o.value === selectedCid)) {
                                                    const name = allUsersMap[selectedCid as number] || '';
                                                    confirmOptions = [
                                                        { value: selectedCid as number, label: `${selectedCid} ${name}` },
                                                        ...baseOptions,
                                                    ];
                                                }
                                                return (
                                                    <SingleSelectCombobox
                                                        options={confirmOptions}
                                                        selected={form.move_out_confirm_user_id || null}
                                                        onChange={(val) => {
                                                            const unknownVal = val as unknown;
                                                            let v: number | string | null | '' = '';
                                                            if (unknownVal && typeof unknownVal === 'object') {
                                                                v = (unknownVal as { value?: number | string }).value ?? '';
                                                            } else {
                                                                v = (unknownVal as number | string | null) ?? '';
                                                            }
                                                            setForm({ ...form, move_out_confirm_user_id: v !== '' && v != null ? Number(v) : '' });
                                                        }}
                                                    />
                                                );
                                            })()}
                                            {renderFieldError('move_out_confirm_user_id')}
                                        </div>

                                        <div>
                                            <Label>退去確認日</Label>
                                            <Input
                                                type="date"
                                                value={form.move_out_confirm_date}
                                                min={form.move_out_date || undefined}
                                                onChange={(e) => setForm({ ...form, move_out_confirm_date: e.target.value })}
                                            />
                                            {renderFieldError('move_out_confirm_date')}
                                        </div>

                                        <div className="col-span-2 flex items-center justify-between pt-2">
                                            {/* when editing (form.id present) show delete button on left */}
                                            <div className="flex items-center">
                                                {form.id ? (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={async () => {
                                                            if (!canDelete) {
                                                                alert('権限がありません');
                                                                return;
                                                            }
                                                            // confirm
                                                            const ok = window.confirm('本当にこの入寮情報を削除しますか？');
                                                            if (!ok) return;
                                                            try {
                                                                await axios.delete(`/api/room-occupancies/${form.id}`);
                                                                // remove from local rowsState
                                                                setRowsState((prev) =>
                                                                    prev.map((r) => ({
                                                                        ...r,
                                                                        occs: r.occs.filter((oc: { id?: number }) => oc.id !== form.id),
                                                                    })),
                                                                );
                                                                setToast({ message: '入寮情報を削除しました', type: 'success' });
                                                                // close form and reset
                                                                setShowMoveInForm(false);
                                                                resetForm();
                                                            } catch (err) {
                                                                // surface error for debugging and avoid unused variable lint
                                                                // eslint-disable-next-line no-console
                                                                console.error(err);
                                                                setToast({ message: '削除に失敗しました', type: 'error' });
                                                            }
                                                        }}
                                                        disabled={!canDelete}
                                                    >
                                                        削除
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <div>
                                                <Button onClick={handleSubmitMoveIn}>{form.id ? '更新' : '登録'}</Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                <div className="flex overflow-hidden rounded border bg-white" style={{ height: 'calc(100vh - 240px)' }}>
                    {/* left fixed column */}
                    <div className="flex w-[160px] flex-none flex-col border-r md:w-[280px]">
                        {/* Fixed header for property column */}
                        <div className="sticky top-0 z-20 border-b bg-gray-50 px-3 py-2 font-medium">物件名</div>
                        {/* Scrollable property list */}
                        <div
                            className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 flex-1 overflow-y-auto"
                            id="property-scroll-container"
                            onScroll={(e) => {
                                // ガントエリアの縦スクロールと連動
                                const ganttScrollContainer = document.getElementById('gantt-scroll-container');
                                if (ganttScrollContainer) {
                                    ganttScrollContainer.scrollTop = e.currentTarget.scrollTop;
                                }
                            }}
                        >
                            {rowsState.map(
                                (r: {
                                    property: { id: number; name: string; address?: string; display_label?: string };
                                    occs: {
                                        id: number;
                                        start: string;
                                        end: string;
                                        user_names?: string[];
                                        user_name?: string;
                                        user_ids?: number[];
                                        user_id?: number;
                                        move_out_confirm_user_name?: string;
                                        move_out_confirm_date?: string;
                                        checkout_user?: { name?: string };
                                        checkout_date?: string;
                                    }[];
                                }) => (
                                    <div key={`left-${r.property.id}`} className="h-16 border-t px-3 py-3">
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0">
                                                {(() => {
                                                    const prop = r.property || {};
                                                    const display = prop.display_label ?? prop.name ?? '';
                                                    const room = prop.room_number || prop.roomNo || prop.room || '';
                                                    const layout = prop.layout || prop.floor_plan || prop.plan || '';
                                                    const showLayout = layout && !String(display).includes(layout);
                                                    return (
                                                        <>
                                                            <div className="truncate text-sm font-medium md:text-base">
                                                                {display}
                                                                {room ? <span>({room})</span> : null}
                                                                {showLayout ? <span> [{layout}]</span> : null}
                                                            </div>
                                                            <div className="truncate text-xs text-gray-500 md:text-sm">{prop.address}</div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            <div className="ml-3 flex flex-shrink-0 items-center">
                                                {(r.property.parking ??
                                                r.property.has_parking ??
                                                r.property.parking_available ??
                                                r.property.parking_space) ? (
                                                    <span className="inline-flex items-center rounded-full bg-green-100 p-1">
                                                        <Car className="h-4 w-4 text-green-600" />
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>

                    {/* right scrollable timeline */}
                    <div className="flex flex-1 flex-col overflow-hidden">
                        {/* Fixed timeline header */}
                        <div className="sticky top-0 z-10 flex-shrink-0 border-b bg-gray-50">
                            <div
                                className="overflow-x-auto"
                                id="header-scroll-container"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                onScroll={(e) => {
                                    // ガントエリアの横スクロールと連動
                                    const ganttScrollContainer = document.getElementById('gantt-scroll-container');
                                    if (ganttScrollContainer) {
                                        ganttScrollContainer.scrollLeft = e.currentTarget.scrollLeft;
                                    }
                                }}
                            >
                                <div className="relative" style={{ minWidth: `${timelineWidth}px` }}>
                                    <div style={{ height: 40 }}>
                                        {days.map((d, idx) => (
                                            <div
                                                key={`hd-${d}`}
                                                className="absolute bottom-0 pl-1 text-left text-xs text-gray-600"
                                                style={{ left: `${idx * cellWidth}px`, width: `${cellWidth}px` }}
                                            >
                                                {formatMonthDay(d)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable gantt area */}
                        <div
                            className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 flex-1 overflow-auto"
                            id="gantt-scroll-container"
                            onScroll={(e) => {
                                // 物件名列の縦スクロールと連動
                                const propertyScrollContainer = document.getElementById('property-scroll-container');
                                if (propertyScrollContainer) {
                                    propertyScrollContainer.scrollTop = e.currentTarget.scrollTop;
                                }
                                // ヘッダーの横スクロールと連動
                                const headerScrollContainer = document.getElementById('header-scroll-container');
                                if (headerScrollContainer) {
                                    headerScrollContainer.scrollLeft = e.currentTarget.scrollLeft;
                                }
                            }}
                        >
                            <div className="relative" style={{ minWidth: `${timelineWidth}px` }}>
                                {rowsState.map(
                                    (r: {
                                        property: { id: number; name: string; address?: string; display_label?: string };
                                        occs: {
                                            id: number;
                                            start: string;
                                            end: string;
                                            user_names?: string[];
                                            user_name?: string;
                                            user_ids?: number[];
                                            user_id?: number;
                                            move_out_confirm_user_name?: string;
                                            move_out_confirm_date?: string;
                                            checkout_user?: { name?: string };
                                            checkout_date?: string;
                                        }[];
                                    }) => (
                                        <div key={`row-${r.property.id}`} className="relative h-16 border-t">
                                            {/* 日付ごとの縦線（変更なし） */}
                                            {days.map((d, idx) => (
                                                <div
                                                    key={`line-${r.property.id}-${d}`}
                                                    className="absolute top-0 bottom-0 z-0 border-l border-gray-200"
                                                    style={{ left: `${idx * cellWidth}px` }}
                                                />
                                            ))}

                                            {/* 物件解約日アイコン（変更なし） */}
                                            {(() => {
                                                const termDate = r.property.termination_date || r.property.cancellation_date || null;
                                                if (!termDate) return null;
                                                if (termDate < startDate || termDate > endDate) return null;
                                                const tIdx = days.indexOf(termDate);
                                                const leftTerm = (tIdx < 0 ? 0 : tIdx) * cellWidth;
                                                const key = `term-${r.property.id}`;
                                                return (
                                                    <div
                                                        key={key}
                                                        className="absolute z-20"
                                                        style={{
                                                            left: `${leftTerm + cellWidth / 2}px`,
                                                            top: '50%',
                                                            transform: 'translate(-50%,-50%)',
                                                        }}
                                                    >
                                                        <Tooltip
                                                            open={openTooltipId === key}
                                                            onOpenChange={(v: boolean) => setOpenTooltipId(v ? key : null)}
                                                        >
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className="rounded-full bg-red-600 p-0.5 shadow-sm"
                                                                    onMouseEnter={() => setOpenTooltipId(key)}
                                                                    onMouseLeave={() => setOpenTooltipId((prev) => (prev === key ? null : prev))}
                                                                >
                                                                    <Flag className="h-4 w-4 text-white" />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" align="center">
                                                                <div className="text-left whitespace-nowrap">
                                                                    物件解約日: {formatMonthDay(termDate)}
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                );
                                            })()}

                                            {/* 1. 退去確認アイコン専用のループを新設 */}
                                            {r.occs.map(
                                                (o: {
                                                    id?: number;
                                                    move_out_confirm_date?: string;
                                                    checkout_date?: string;
                                                    move_out_confirm_user_name?: string;
                                                    checkout_user?: { name?: string };
                                                }) => {
                                                    const confirmDate = o.move_out_confirm_date || o.checkout_date || null;
                                                    if (!confirmDate) return null;
                                                    // 表示中の月に確認日が含まれる場合のみアイコンを表示
                                                    if (confirmDate < startDate || confirmDate > endDate) return null;
                                                    const cIdx = days.indexOf(confirmDate);
                                                    if (cIdx < 0) return null;

                                                    // アイコンの位置を行の左端からの絶対位置として計算
                                                    const leftC = cIdx * cellWidth;
                                                    const iconKey = `confirm-${o.id}`;
                                                    const confirmerName =
                                                        o.move_out_confirm_user_name || (o.checkout_user && o.checkout_user.name) || '';
                                                    // resolve user display names for this occupancy (single or multiple)
                                                    const usersDisplay = (() => {
                                                        if (Array.isArray(o.user_names)) {
                                                            const resolved = o.user_names.filter(Boolean).map((n: string) => {
                                                                if (typeof n === 'string' && n.startsWith('user:')) {
                                                                    const id = Number(n.split(':')[1]);
                                                                    return allUsersMap[id] || n;
                                                                }
                                                                return n;
                                                            });
                                                            return resolved.join(', ');
                                                        }
                                                        if (o.user_name) return o.user_name;
                                                        if (Array.isArray(o.user_ids))
                                                            return o.user_ids.map((id: number) => allUsersMap[id] || `user:${id}`).join(', ');
                                                        if (o.user_id) return allUsersMap[o.user_id] || `user:${o.user_id}`;
                                                        return '';
                                                    })();

                                                    return (
                                                        <div
                                                            key={iconKey}
                                                            className="absolute z-30"
                                                            style={{
                                                                left: `${leftC + cellWidth / 2}px`,
                                                                top: '50%',
                                                                transform: 'translate(-50%,-50%)',
                                                            }}
                                                        >
                                                            <Tooltip
                                                                open={openTooltipId === iconKey}
                                                                onOpenChange={(v: boolean) => setOpenTooltipId(v ? iconKey : null)}
                                                            >
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        className="rounded-full bg-green-600 p-0.5 shadow-sm"
                                                                        onMouseEnter={() => setOpenTooltipId(iconKey)}
                                                                        onMouseLeave={() =>
                                                                            setOpenTooltipId((prev) => (prev === iconKey ? null : prev))
                                                                        }
                                                                    >
                                                                        <User className="h-4 w-4 text-white" />
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" align="center">
                                                                    <div className="text-left whitespace-nowrap">
                                                                        <div className="font-medium">
                                                                            {usersDisplay ? (
                                                                                <div>
                                                                                    <span>【{usersDisplay}】 </span>
                                                                                </div>
                                                                            ) : null}
                                                                            {r.property.display_label ?? r.property.name}
                                                                            {r.property &&
                                                                            (r.property.room_number || r.property.roomNo || r.property.room) ? (
                                                                                <div>
                                                                                    <span>
                                                                                        (
                                                                                        {r.property.room_number ||
                                                                                            r.property.roomNo ||
                                                                                            r.property.room}
                                                                                        )
                                                                                    </span>
                                                                                </div>
                                                                            ) : null}
                                                                            {r.property &&
                                                                            (r.property.layout || r.property.floor_plan || r.property.plan) ? (
                                                                                <span>
                                                                                    {' '}
                                                                                    [{r.property.layout || r.property.floor_plan || r.property.plan}]
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        <div>
                                                                            退去確認: {confirmerName || '—'} ({formatMonthDay(confirmDate)})
                                                                        </div>
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    );
                                                },
                                            )}

                                            {/* 2. 既存のガントバー表示ロジック（アイコン描画部分を削除） */}
                                            {r.occs
                                                .filter((o: { start?: string; end?: string }) => {
                                                    if (!o.start || !o.end) return false;
                                                    if (o.end < startDate) return false;
                                                    if (o.start > endDate) return false;
                                                    return true;
                                                })
                                                .map(
                                                    (o: {
                                                        id?: number;
                                                        start?: string;
                                                        end?: string;
                                                        user_names?: string[];
                                                        user_name?: string;
                                                        user_ids?: number[];
                                                        user_id?: number;
                                                        open_ended?: boolean;
                                                    }) => {
                                                        let sIdx = days.indexOf(o.start);
                                                        let eIdx = o.open_ended ? days.length - 1 : days.indexOf(o.end);
                                                        if (sIdx < 0) sIdx = 0;
                                                        if (eIdx < 0) eIdx = days.length - 1;
                                                        if (eIdx < sIdx) eIdx = sIdx;
                                                        const left = sIdx * cellWidth;
                                                        const width = (eIdx - sIdx + 1) * cellWidth;

                                                        let usersDisplay = '';
                                                        if (Array.isArray(o.user_names)) {
                                                            const resolved = o.user_names.filter(Boolean).map((n: string) => {
                                                                if (typeof n === 'string' && n.startsWith('user:')) {
                                                                    const id = Number(n.split(':')[1]);
                                                                    return allUsersMap[id] || n;
                                                                }
                                                                return n;
                                                            });
                                                            usersDisplay = resolved.join(', ');
                                                        } else if (o.user_name) {
                                                            usersDisplay = o.user_name;
                                                        } else if (Array.isArray(o.user_ids)) {
                                                            const resolved = o.user_ids.map((id: number) => allUsersMap[id] || `user:${id}`);
                                                            usersDisplay = resolved.join(', ');
                                                        } else if (o.user_id) {
                                                            usersDisplay = allUsersMap[o.user_id] || `user:${o.user_id}`;
                                                        }

                                                        const label = o.open_ended
                                                            ? `${usersDisplay} (${formatMonthDay(o.start)}〜)`
                                                            : `${usersDisplay} (${formatMonthDay(o.start)}〜${formatMonthDay(o.end)})`;
                                                        const propertyLabel = r.property.display_label ?? r.property.name;

                                                        return (
                                                            <div
                                                                key={o.id}
                                                                className={`absolute z-10 ${isSmallScreen ? 'top-2 h-6' : 'top-3 h-8'}`}
                                                                style={{ left: `${left}px`, width: `${width}px` }}
                                                            >
                                                                {/* 元々ここにあったアイコンのロジックは上記で分離したため削除 */}
                                                                <Tooltip
                                                                    open={openTooltipId === o.id}
                                                                    onOpenChange={(v: boolean) => setOpenTooltipId(v ? o.id : null)}
                                                                >
                                                                    <TooltipTrigger asChild>
                                                                        <div
                                                                            className={`flex items-center overflow-hidden rounded bg-sky-500/80 px-2 text-sm text-white shadow-sm ${
                                                                                isSmallScreen ? 'h-6 text-xs' : 'h-8'
                                                                            }`}
                                                                            onClick={() => {
                                                                                // block opening edit form if user lacks edit permission
                                                                                if (!canEdit) {
                                                                                    alert('権限がありません');
                                                                                    return;
                                                                                }
                                                                                // open edit form populated with this occupancy
                                                                                setShowMoveInForm(true);
                                                                                const uids = Array.isArray(o.user_ids)
                                                                                    ? o.user_ids
                                                                                    : o.user_id
                                                                                      ? [o.user_id]
                                                                                      : [];
                                                                                const cid = o.move_out_confirm_user_id ?? o.checkout_user_id ?? null;
                                                                                setForm({
                                                                                    id: o.id,
                                                                                    property_id: r.property.id,
                                                                                    user_ids: uids,
                                                                                    move_in_date: o.start || new Date().toISOString().slice(0, 10),
                                                                                    move_out_date: o.open_ended ? '' : o.end || '',
                                                                                    move_out_confirm_user_id: cid ? Number(cid) : '',
                                                                                    move_out_confirm_date:
                                                                                        o.move_out_confirm_date || o.checkout_date || '',
                                                                                });
                                                                                if (isTouch) setOpenTooltipId(openTooltipId === o.id ? null : o.id);
                                                                            }}
                                                                            onMouseEnter={() => setOpenTooltipId(o.id)}
                                                                            onMouseLeave={() =>
                                                                                setOpenTooltipId((prev) => (prev === o.id ? null : prev))
                                                                            }
                                                                        >
                                                                            <span className="truncate">{label}</span>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" align="center">
                                                                        <div className="text-left whitespace-nowrap">
                                                                            <div className="font-medium">{propertyLabel}</div>
                                                                            <div>{label}</div>
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                        );
                                                    },
                                                )}
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppSidebarLayout>
    );
}
