import { BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Textarea } from '@/components/ui/textarea';
// ADDED: Dialogコンポーネントをインポートします
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { CheckCircle, ChevronLeft, ChevronRight, Clock, Plus, XCircle } from 'lucide-react';

type TaskEvent = {
    id: number;
    title: string;
    start_at?: string | null;
    end_at?: string | null;
    category_color?: string | null;
    description?: string | null;
    assignees?: { id: number; name: string }[];
    user_id?: number | null;
    status?: string | null;
    category_name?: string | null;
};

// API から受け取るタスクの最小形
type ApiTask = {
    id: number;
    title: string;
    start_at?: string | null;
    end_at?: string | null;
    category?: { id?: number; name?: string | null; color?: string | null } | null;
    description?: string | null;
    assignees?: { id: number; name: string }[];
    user_id?: number | null;
    status?: string | null;
    user_ids?: number[] | number | null;
};

// PlacedEventの型定義をコンポーネントのトップレベルに移動し、再利用しやすくします
type PlacedEvent = {
    id: number;
    title: string;
    start: Date;
    end: Date;
    weekIndex: number;
    startIndex: number;
    endIndex: number;
    row: number;
    color?: string | null;
    description?: string | null;
    assignees?: { id: number; name: string }[];
    category_name?: string | null;
    user_id?: number | null;
    status?: string | null;
    originalEndMissing?: boolean;
};

export default function TasksCalendarPage() {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'タスク・予定', href: '/tasks' }, { title: 'カレンダー' }];
    const [events, setEvents] = useState<TaskEvent[]>(() => {
        try {
            const ssrTasks = (page.props as unknown as { tasks?: any[] }).tasks;
            if (Array.isArray(ssrTasks) && ssrTasks.length > 0) {
                return ssrTasks
                    .map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        start_at: t.start_at,
                        end_at: t.end_at,
                        category_color: t.category && t.category.color ? t.category.color : null,
                        category_name: t.category && t.category.name ? t.category.name : null,
                        description: t.description ?? null,
                        assignees: t.assignees ?? [],
                        user_id: t.user_id ?? null,
                        status: t.status ?? null,
                    }))
                    .filter((e: TaskEvent) => e.start_at);
            }
        } catch {
            // ignore
        }
        return [];
    });
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    // ADDED: クリックされたイベント詳細を保持するためのstate
    const [selectedEvent, setSelectedEvent] = useState<PlacedEvent | null>(null);
    // state to show list of hidden events when user clicks "他N件"
    const [moreList, setMoreList] = useState<PlacedEvent[] | null>(null);
    const [moreDialogOpen, setMoreDialogOpen] = useState(false);

    // 現在ログイン中のユーザーIDと共有権限を Inertia の共有 props から取得
    const page = usePage<any>();
    const pageProps = page.props as unknown as { auth?: { user?: { id?: number } }; permissions?: any };
    const currentUserId: number | null = pageProps?.auth?.user?.id ?? null;
    const taskPerm = pageProps?.permissions?.task ?? { view: false, create: false, update: false, delete: false };

    // 編集フォーム用 state
    const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [availableRoles, setAvailableRoles] = useState<{ id: number; name: string }[]>([]);
    // 祝日: サーバから取得するマップ (YYYY-MM-DD -> 名前)
    const [holidaysMap, setHolidaysMap] = useState<Record<string, string>>({});
    const [editing, setEditing] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editForm, setEditForm] = useState<{
        title: string;
        description: string;
        start_at: string;
        end_at: string;
        user_ids: number[];
        task_category_id?: number | null;
        status?: string | null;
        audience?: 'all' | 'restricted';
        roles?: number[];
    }>({ title: '', description: '', start_at: '', end_at: '', user_ids: [], task_category_id: null, status: '未着手', audience: 'all', roles: [] });
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    // toast がセットされたら自動で消えるようにしておく（かつ "toast" 変数を参照して未使用警告を解消）
    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(id);
    }, [toast]);

    const fetchHolidaysForMonth = useCallback(
        async (monthDate: Date) => {
            try {
                const ssrHolidays = (page.props as unknown as { holidays?: any[] }).holidays;
                if (Array.isArray(ssrHolidays) && ssrHolidays.length > 0) {
                    if (typeof ssrHolidays[0] === 'string') {
                        try {
                            const mParam = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
                            const hres = await axios.get('/api/holidays', { params: { month: mParam } });
                            const list = hres.data.holidays || [];
                            const map: Record<string, string> = {};
                            for (const it of list) {
                                if (it && it.date) map[String(it.date)] = it.name || '';
                            }
                            setHolidaysMap(map);
                            return;
                        } catch {
                            const map: Record<string, string> = {};
                            for (const d of ssrHolidays) map[String(d)] = '';
                            setHolidaysMap(map);
                            return;
                        }
                    }
                    const year = String(monthDate.getFullYear());
                    const month = String(monthDate.getMonth() + 1).padStart(2, '0');
                    const prefix = `${year}-${month}`;
                    const monthItems = ssrHolidays.filter((it: any) => it && it.date && String(it.date).startsWith(prefix));
                    if (monthItems.length > 0) {
                        const map: Record<string, string> = {};
                        for (const it of monthItems) {
                            map[String(it.date)] = it.name || '';
                        }
                        setHolidaysMap(map);
                        return;
                    }
                }

                const mParam = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
                const hres = await axios.get('/api/holidays', { params: { month: mParam } });
                const list = hres.data.holidays || [];
                const map: Record<string, string> = {};
                for (const it of list) {
                    if (it && it.date) map[String(it.date)] = it.name || '';
                }
                setHolidaysMap(map);
            } catch {
                // ignore
            }
        },
        [page.props],
    );

    const fetchAll = useCallback(async () => {
        try {
            // If server provided tasks in SSR props, use them and avoid a second API call
            const ssrTasks = (page.props as unknown as { tasks?: any[] }).tasks;
            if (Array.isArray(ssrTasks) && ssrTasks.length > 0) {
                const mapped: TaskEvent[] = ssrTasks.map((t: ApiTask) => ({
                    id: t.id,
                    title: t.title,
                    start_at: t.start_at,
                    end_at: t.end_at,
                    category_color: t.category && t.category.color ? t.category.color : null,
                    category_name: t.category && t.category.name ? t.category.name : null,
                    description: t.description ?? null,
                    assignees: t.assignees ?? [],
                    user_id: t.user_id ?? null,
                    status: t.status ?? null,
                }));
                setEvents(mapped.filter((e) => e.start_at));
            } else {
                const res = await axios.get('/api/tasks');
                const tasks = res.data.tasks || [];
                const mapped: TaskEvent[] = tasks.map((t: ApiTask) => ({
                    id: t.id,
                    title: t.title,
                    start_at: t.start_at,
                    end_at: t.end_at,
                    category_color: t.category && t.category.color ? t.category.color : null,
                    category_name: t.category && t.category.name ? t.category.name : null,
                    description: t.description ?? null,
                    assignees: t.assignees ?? [],
                    user_id: t.user_id ?? null,
                    status: t.status ?? null,
                }));
                setEvents(mapped.filter((e) => e.start_at));
            }

            try {
                const ures = await axios.get('/api/active-users');
                setUsers(ures.data.users || []);
            } catch {
                // ignore
            }
            try {
                const cres = await axios.get('/api/task-categories');
                setCategories(cres.data.categories || []);
            } catch {
                // ignore
            }
            try {
                const rres = await axios.get('/api/roles');
                // RoleController returns either a JSON-wrapped { roles: [...] } or a plain array.
                setAvailableRoles(rres.data?.roles ?? (Array.isArray(rres.data) ? rres.data : []));
            } catch {
                // ignore
            }
            // load holidays for the current month (may use SSR-provided data or API)
            await fetchHolidaysForMonth(currentMonth);
        } catch (e) {
            console.error(e);
        }
    }, [fetchHolidaysForMonth, currentMonth, page.props]);

    // helper: parse DB date formats used across tasks pages
    const parseDbDate = (raw?: string | null): Date | null => {
        if (!raw) return null;
        const dbSpaceFormat = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*$/;
        const m = String(raw).match(dbSpaceFormat);
        if (m) {
            const year = Number(m[1]);
            const month = Number(m[2]);
            const day = Number(m[3]);
            const hour = Number(m[4]);
            const minute = Number(m[5]);
            const second = m[6] ? Number(m[6]) : 0;
            return new Date(year, month - 1, day, hour, minute, second);
        }
        const iso = new Date(raw as string);
        if (!isNaN(iso.getTime())) return iso;
        return null;
    };

    // map API task shape to local TaskEvent
    const mapApiTaskToTaskEvent = (t: ApiTask): TaskEvent => ({
        id: t.id,
        title: t.title,
        start_at: t.start_at,
        end_at: t.end_at,
        category_color: t.category && t.category.color ? t.category.color : null,
        category_name: t.category && t.category.name ? t.category.name : null,
        description: t.description ?? null,
        assignees: t.assignees ?? [],
        user_id: t.user_id ?? null,
        status: t.status ?? null,
    });

    // (fetchHolidaysForMonth is defined above as a useCallback)

    const translateValidationErrors = (raw: Record<string, string[]>) => {
        const labels: Record<string, string> = {
            title: 'タイトル',
            task_category_id: 'カテゴリ',
            start_at: '開始日時',
            end_at: '終了日時',
            user_ids: '担当者',
            description: '説明',
        };
        const out: Record<string, string[]> = {};
        for (const k of Object.keys(raw || {})) {
            const arr = (raw as Record<string, string[]>)[k] as string[];
            const label = labels[k] || k;
            out[k] = arr.map((m) => {
                const low = String(m).toLowerCase();
                if (low.includes('required') || low.includes('必須')) return `${label}は必須です`;
                if (low.includes('date')) return `${label}は有効な日付形式で入力してください`;
                if (low.includes('max') || low.includes('characters') || low.includes('文字')) return `${label}は文字数が多すぎます`;
                if (low.includes('array') || low.includes('array')) return `${label}の形式が正しくありません`;
                return m;
            });
        }
        return out;
    };

    // compute the first day of the shown month and the calendar weeks
    const monthStart = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);

    const weeks = useMemo(() => {
        const firstDayOfMonth = new Date(monthStart);
        const startDay = new Date(firstDayOfMonth);
        const weekday = startDay.getDay();
        const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
        startDay.setDate(startDay.getDate() + diffToMonday);
        const weeksArr: Date[][] = [];
        for (let w = 0; w < 6; w++) {
            const week: Date[] = [];
            for (let d = 0; d < 7; d++) {
                const day = new Date(startDay);
                day.setDate(startDay.getDate() + w * 7 + d);
                week.push(day);
            }
            weeksArr.push(week);
        }
        return weeksArr;
    }, [monthStart]);

    // initial data load
    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    // when the current month changes, refresh holidays for that month
    useEffect(() => {
        void fetchHolidaysForMonth(currentMonth);
    }, [fetchHolidaysForMonth, currentMonth]);

    const calendarData = useMemo(() => {
        const parsed = events
            .map((e: TaskEvent) => {
                const s = parseDbDate(e.start_at);
                const en = parseDbDate(e.end_at);
                if (!s) return null;
                // If end is missing, treat it as an all-day event on the start date
                if (!en) {
                    const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
                    const ed = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999);
                    return {
                        id: e.id,
                        title: e.title,
                        start: sd,
                        end: ed,
                        // mark that original end was missing so UI can adjust badges/labels
                        originalEndMissing: true,
                        color: e.category_color ?? null,
                        description: e.description ?? null,
                        assignees: e.assignees ?? [],
                        category_name: e.category_name ?? null,
                        user_id: e.user_id ?? null,
                        status: e.status ?? null,
                    };
                }
                return {
                    id: e.id,
                    title: e.title,
                    start: s,
                    end: en,
                    originalEndMissing: false,
                    color: e.category_color ?? null,
                    description: e.description ?? null,
                    assignees: e.assignees ?? [],
                    category_name: e.category_name ?? null,
                    user_id: e.user_id ?? null,
                    status: e.status ?? null,
                };
            })
            .filter(Boolean) as {
            id: number;
            title: string;
            start: Date;
            end: Date;
            color?: string | null;
            description?: string | null;
            assignees?: { id: number; name: string }[];
            category_name?: string | null;
            user_id?: number | null;
            status?: string | null;
        }[];

        const placedByWeek: Record<number, PlacedEvent[]> = {};
        weeks.forEach((week, wi) => {
            const weekStart = new Date(week[0]);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(week[6]);
            weekEnd.setHours(23, 59, 59, 999);
            const weekEvents: PlacedEvent[] = [];
            for (const p of parsed) {
                if (p.end < weekStart || p.start > weekEnd) continue;
                const startIndex = Math.max(0, Math.floor((p.start.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)));
                const endIndex = Math.min(6, Math.floor((p.end.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)));
                weekEvents.push({ ...p, weekIndex: wi, startIndex, endIndex, row: 0 });
            }
            const rows: { occupied: [number, number][] }[] = [];
            weekEvents.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
            for (const ev of weekEvents) {
                let placedRow = -1;
                for (let r = 0; r < rows.length; r++) {
                    const conflict = rows[r].occupied.some(([s, e]) => !(ev.endIndex < s || ev.startIndex > e));
                    if (!conflict) {
                        placedRow = r;
                        rows[r].occupied.push([ev.startIndex, ev.endIndex]);
                        break;
                    }
                }
                if (placedRow !== -1) {
                    ev.row = placedRow;
                } else {
                    rows.push({ occupied: [[ev.startIndex, ev.endIndex]] });
                    ev.row = rows.length - 1;
                }
            }
            placedByWeek[wi] = weekEvents;
        });

        const moreByWeek: Record<number, { startIndex: number; count: number; endIndex: number }[]> = {};
        Object.keys(placedByWeek).forEach((wiStr) => {
            const wi = Number(wiStr);
            const hiddenEvents = (placedByWeek[wi] || []).filter((ev) => ev.row >= 3);
            if (hiddenEvents.length === 0) {
                moreByWeek[wi] = [];
                return;
            }
            const moreCountPerDay = Array(7).fill(0);
            for (const ev of hiddenEvents) {
                for (let d = ev.startIndex; d <= ev.endIndex; d++) {
                    moreCountPerDay[d]++;
                }
            }
            const moreBars: { startIndex: number; count: number; endIndex: number }[] = [];
            let currentBar: { startIndex: number; count: number; endIndex: number } | null = null;
            for (let i = 0; i < 7; i++) {
                const count = moreCountPerDay[i];
                if (count > 0) {
                    if (currentBar && currentBar.count === count) {
                        currentBar.endIndex = i;
                    } else {
                        if (currentBar) moreBars.push(currentBar);
                        currentBar = { startIndex: i, endIndex: i, count };
                    }
                } else {
                    if (currentBar) {
                        moreBars.push(currentBar);
                        currentBar = null;
                    }
                }
            }
            if (currentBar) moreBars.push(currentBar);
            moreByWeek[wi] = moreBars;
        });

        return { placedByWeek, moreByWeek };
    }, [events, weeks]);

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatLocalIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const goPrev = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    const goNext = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

    // 日付フォーマット用のヘルパー関数 — 要望: m/d h:mi（前ゼロなし、分は2桁）
    const formatEventDate = (d: Date) => {
        const M = d.getMonth() + 1; // 月（前ゼロなし）
        const D = d.getDate(); // 日（前ゼロなし）
        const H = d.getHours(); // 時（前ゼロなし）
        const m = String(d.getMinutes()).padStart(2, '0'); // 分（2桁）
        return `${M}/${D} ${H}:${m}`;
    };

    const getStatusIcon = (status?: string | null) => {
        switch (status) {
            case '未着手':
                return <Clock className="mr-1 inline-block h-3 w-3" />;
            case '進行中':
                return <Clock className="mr-1 inline-block h-3 w-3" />; // placeholder
            case '完了':
                return <CheckCircle className="mr-1 inline-block h-3 w-3" />;
            case 'キャンセル':
                return <XCircle className="mr-1 inline-block h-3 w-3" />;
            default:
                return null;
        }
    };

    const renderStatusBadge = (status?: string | null) => {
        if (!status) return null;
        switch (status) {
            case '未着手':
                return <Badge className="bg-gray-100 text-gray-800">未着手</Badge>;
            case '進行中':
                return <Badge className="bg-amber-100 text-amber-800">進行中</Badge>;
            case '完了':
                return <Badge className="bg-green-100 text-green-800">完了</Badge>;
            case 'キャンセル':
                return <Badge className="bg-red-100 text-red-800">キャンセル</Badge>;
            case '保留':
                return <Badge className="bg-yellow-100 text-yellow-800">保留</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    // DB 日時 <-> input[type=datetime-local] の変換
    const dbDateToInputValue = (raw?: string | null) => {
        if (!raw) return '';
        const m = String(raw).match(/^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*$/);
        if (m) {
            const year = m[1];
            const month = String(m[2]).padStart(2, '0');
            const day = String(m[3]).padStart(2, '0');
            const hour = String(m[4]).padStart(2, '0');
            const minute = String(m[5]).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}`;
        }
        const parsed = parseDbDate(raw);
        if (!parsed) return '';
        const y = parsed.getFullYear();
        const mo = String(parsed.getMonth() + 1).padStart(2, '0');
        const da = String(parsed.getDate()).padStart(2, '0');
        const ho = String(parsed.getHours()).padStart(2, '0');
        const mi = String(parsed.getMinutes()).padStart(2, '0');
        return `${y}-${mo}-${da}T${ho}:${mi}`;
    };

    const inputValueToDbDate = (v: string) => {
        if (!v) return null;
        // v is like 'YYYY-MM-DDTHH:MM'
        return v.replace('T', ' ') + ':00';
    };

    const loadTaskForEdit = async (id: number) => {
        try {
            const res = await axios.get(`/api/tasks/${id}`);
            const t = res.data.task;
            setEditForm({
                title: t.title || '',
                description: t.description || '',
                start_at: dbDateToInputValue(t.start_at),
                end_at: dbDateToInputValue(t.end_at),
                user_ids: Array.isArray(t.user_ids)
                    ? t.user_ids.map((v: unknown) => Number(String(v)))
                    : t.user_ids
                      ? [Number(t.user_ids as unknown as number)]
                      : [],
                task_category_id: t.category ? t.category.id : null,
                status: t.status || '未着手',
                audience: t.audience || 'all',
                roles: Array.isArray(t.roles) ? t.roles.map((r: any) => r.id) : [],
            });
            setErrors({});
            setEditing(true);
        } catch (e) {
            console.error(e);
            setToast({ message: 'タスクの読み込みに失敗しました', type: 'error' });
        }
    };

    const startEditFromSelected = () => {
        if (!selectedEvent) return;
        void loadTaskForEdit(selectedEvent.id);
    };

    const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError(null);
        setErrors({});
        // client-side validation: end_at must be >= start_at
        if (editForm.start_at && editForm.end_at) {
            const s = new Date(editForm.start_at);
            const en = new Date(editForm.end_at);
            if (en.getTime() < s.getTime()) {
                const msg = '終了日時は開始日時以降である必要があります';
                setErrors({ end_at: [msg] });
                setFormError(msg);
                return;
            }
        }
        try {
            const payload: Record<string, unknown> = { ...editForm, id: selectedEvent?.id };
            payload.start_at = editForm.start_at ? inputValueToDbDate(editForm.start_at) : null;
            payload.end_at = editForm.end_at ? inputValueToDbDate(editForm.end_at) : null;
            // Ensure user_ids is explicitly included: array when selected, or null when none selected
            payload.user_ids = editForm.user_ids && editForm.user_ids.length > 0 ? editForm.user_ids : null;
            // include audience and roles explicitly
            if (editForm.audience) payload.audience = editForm.audience;
            if (editForm.roles && editForm.roles.length > 0) payload.roles = editForm.roles;
            const res = await axios.post('/api/tasks', payload);
            const updatedTask =
                (res && res.data && (res.data.task || res.data.task === null) ? res.data.task : res.data.task) || res.data.task || res.data;
            // fallback: if server returns updated task in res.data.task, use it; otherwise use res.data
            const mapped = mapApiTaskToTaskEvent(updatedTask as ApiTask);
            setEvents((prev) => prev.map((ev) => (ev.id === mapped.id ? mapped : ev)));
            // build a placed event for the modal
            const s = parseDbDate(mapped.start_at);
            const en = parseDbDate(mapped.end_at);
            if (s) {
                const placed: PlacedEvent = {
                    id: mapped.id,
                    title: mapped.title,
                    start: s,
                    end: en ?? new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999),
                    weekIndex: 0,
                    startIndex: 0,
                    endIndex: 0,
                    row: 0,
                    color: mapped.category_color ?? null,
                    description: mapped.description ?? null,
                    assignees: mapped.assignees ?? [],
                    category_name: mapped.category_name ?? null,
                    user_id: mapped.user_id ?? null,
                    status: mapped.status ?? null,
                    originalEndMissing: !en,
                };
                setSelectedEvent(placed);
            }
            setToast({ message: res.data.message || '更新しました', type: 'success' });
            setEditing(false);
        } catch (err) {
            const maybeResponse = (err as { response?: unknown } | null)?.response;
            if (maybeResponse && typeof maybeResponse === 'object' && maybeResponse !== null) {
                const data = (maybeResponse as Record<string, unknown>)['data'];
                if (data && typeof data === 'object' && data !== null) {
                    const dataObj = data as Record<string, unknown>;
                    const errorsVal = dataObj['errors'];
                    if (errorsVal && typeof errorsVal === 'object') {
                        setErrors(translateValidationErrors(errorsVal as Record<string, string[]>));
                        return;
                    }
                    if (typeof dataObj['message'] !== 'undefined') {
                        setFormError(String(dataObj['message']));
                        return;
                    }
                }
            }
            setToast({ message: '通信エラー', type: 'error' });
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="タスクカレンダー（月表示）" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <Button size="sm" onClick={goPrev} aria-label="前月">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <h2 className="text-xl font-semibold">
                                {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                            </h2>
                            <Button size="sm" onClick={goNext} aria-label="次月">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                try {
                                    window.history.back();
                                } catch {
                                    /* ignore */
                                }
                            }}
                        >
                            戻る
                        </Button>
                        {taskPerm.create ? (
                            <Button
                                onClick={() => {
                                    // reset form to defaults for creation
                                    setEditForm({
                                        title: '',
                                        description: '',
                                        start_at: '',
                                        end_at: '',
                                        user_ids: [],
                                        task_category_id: null,
                                        status: '未着手',
                                        audience: 'all',
                                        roles: [],
                                    });
                                    setErrors({});
                                    setCreateOpen(true);
                                }}
                            >
                                <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">新規登録</span>
                            </Button>
                        ) : null}
                    </div>
                </div>

                <Card>
                    <CardContent className="p-2 sm:p-4">
                        <div className="grid grid-cols-7 gap-1 border-b pb-2 text-center text-xs">
                            {['月', '火', '水', '木', '金', '土', '日'].map((w, i) => {
                                const cls = i === 5 ? 'text-blue-600' : i === 6 ? 'text-red-600' : 'text-gray-600';
                                return (
                                    <div key={w} className={`text-sm font-medium ${cls}`}>
                                        {w}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-1 space-y-1">
                            {weeks.map((week, wi) => (
                                <div key={`week-${wi}`} className="relative">
                                    <div className="grid grid-cols-7">
                                        {week.map((d) => {
                                            const isToday = d.toDateString() === new Date().toDateString();
                                            const inMonth = d.getMonth() === monthStart.getMonth();
                                            const dayStr = formatLocalIso(d); // use local YYYY-MM-DD to match DB stored dates
                                            const isSat = d.getDay() === 6;
                                            const isSun = d.getDay() === 0;
                                            const holidayName = holidaysMap[dayStr] || null;
                                            const isHoliday = !!holidayName;
                                            const cellBg = !inMonth
                                                ? 'bg-gray-50 text-gray-400'
                                                : isHoliday
                                                  ? 'bg-red-50'
                                                  : isSun
                                                    ? 'bg-red-50'
                                                    : isSat
                                                      ? 'bg-blue-50'
                                                      : '';
                                            return (
                                                <div key={dayStr} className={`min-h-[120px] border-t border-l p-1 text-left text-sm ${cellBg}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                                                                isToday ? 'bg-blue-600 font-bold text-white' : ''
                                                            }`}
                                                        >
                                                            {d.getDate()}
                                                        </div>
                                                        {/* 祝日名を日付の右に表示（長い場合は省略） */}
                                                        {isHoliday ? (
                                                            <div
                                                                className="hidden max-w-[8rem] truncate text-xs text-red-600 md:block md:max-w-[12rem]"
                                                                title={holidayName}
                                                            >
                                                                {holidayName}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="pointer-events-none absolute inset-0" style={{ top: '28px' }}>
                                        {(calendarData.placedByWeek[wi] || [])
                                            .filter((ev) => ev.row < 3)
                                            .map((ev) => {
                                                const leftPct = (ev.startIndex / 7) * 100;
                                                const widthPct = ((ev.endIndex - ev.startIndex + 1) / 7) * 100;
                                                const top = ev.row * 24;
                                                const bg = ev.color || '#2f80ed';
                                                const textColor = (() => {
                                                    try {
                                                        const c = (bg || '#2f80ed').replace('#', '');
                                                        const r = parseInt(c.substring(0, 2), 16);
                                                        const g = parseInt(c.substring(2, 4), 16);
                                                        const b = parseInt(c.substring(4, 6), 16);
                                                        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                                                        return luminance > 160 ? '#000' : '#fff';
                                                    } catch {
                                                        return '#fff';
                                                    }
                                                })();
                                                const isSameDay =
                                                    ev.start.getFullYear() === ev.end.getFullYear() &&
                                                    ev.start.getMonth() === ev.end.getMonth() &&
                                                    ev.start.getDate() === ev.end.getDate();
                                                const dateLabel = isSameDay
                                                    ? `${ev.start.getMonth() + 1}/${ev.start.getDate()}`
                                                    : `${ev.start.getMonth() + 1}/${ev.start.getDate()}~${ev.end.getMonth() + 1}/${ev.end.getDate()}`;
                                                return (
                                                    <div
                                                        key={`span-${ev.id}-${wi}`}
                                                        // ADDED: クリック時にイベント詳細をセットする
                                                        onClick={() => setSelectedEvent(ev)}
                                                        className="pointer-events-auto absolute cursor-pointer overflow-hidden rounded px-2 py-0.5 text-xs transition-colors"
                                                        style={{
                                                            left: `calc(${leftPct}% + 2px)`,
                                                            width: `calc(${widthPct}% - 4px)`,
                                                            top,
                                                            zIndex: 10,
                                                            background: bg,
                                                            color: textColor,
                                                            border: '1px solid rgba(0,0,0,0.08)',
                                                        }}
                                                        title={`${ev.title} (${new Date(ev.start).toLocaleDateString()}${isSameDay ? '' : ` - ${new Date(ev.end).toLocaleDateString()}`})`}
                                                    >
                                                        <div className="flex items-center truncate font-semibold">
                                                            {getStatusIcon(ev.status)}
                                                            <span>
                                                                {ev.title} ({dateLabel})
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                        {(calendarData.moreByWeek[wi] || []).map((bar, barIndex) => {
                                            const leftPct = (bar.startIndex / 7) * 100;
                                            const widthPct = ((bar.endIndex - bar.startIndex + 1) / 7) * 100;
                                            const top = 3 * 24;
                                            return (
                                                <div
                                                    key={`more-${wi}-${barIndex}`}
                                                    className="pointer-events-auto absolute cursor-pointer rounded px-2 py-0.5 text-xs font-bold text-gray-700 hover:underline"
                                                    style={{
                                                        left: `calc(${leftPct}% + 2px)`,
                                                        width: `calc(${widthPct}% - 4px)`,
                                                        top,
                                                        zIndex: 10,
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const hiddenEvents = (calendarData.placedByWeek[wi] || []).filter(
                                                            (ev) => ev.row >= 3 && ev.startIndex <= bar.endIndex && ev.endIndex >= bar.startIndex,
                                                        );
                                                        setMoreList(hiddenEvents);
                                                        setMoreDialogOpen(true);
                                                    }}
                                                >
                                                    他{bar.count}件
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ===== ここからが詳細表示ダイアログの追加箇所です ===== */}
            <Dialog open={!!selectedEvent} onOpenChange={(isOpen) => !isOpen && setSelectedEvent(null)}>
                <DialogContent className="max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedEvent?.title}</DialogTitle>
                        {selectedEvent?.category_name ? (
                            <DialogDescription>
                                <span className="font-medium">{selectedEvent.category_name}</span>
                            </DialogDescription>
                        ) : null}
                    </DialogHeader>
                    {selectedEvent && !editing && (
                        <div className="space-y-4 py-4">
                            {/* ステータスをバッジで表示 */}
                            <div>
                                <div className="text-sm text-muted-foreground">ステータス</div>
                                <div className="mt-1">{renderStatusBadge(selectedEvent.status)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">期間:</span>
                                <span className="text-sm">
                                    {(() => {
                                        if (!selectedEvent) return '';
                                        const s = selectedEvent.start;
                                        const e = selectedEvent.end;
                                        const sameDay =
                                            s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
                                        return sameDay ? formatEventDate(s) : `${formatEventDate(s)} 〜 ${formatEventDate(e)}`;
                                    })()}
                                </span>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground">担当者</div>
                                <div className="mt-1 text-sm">
                                    {selectedEvent.assignees && selectedEvent.assignees.length > 0 ? (
                                        <ul className="list-inside list-disc">
                                            {selectedEvent.assignees.map((a) => (
                                                <li key={a.id}>{a.name}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-sm text-gray-500">担当者なし</span>
                                    )}
                                </div>
                            </div>

                            {selectedEvent.description ? (
                                <div>
                                    <div className="text-sm text-muted-foreground">内容</div>
                                    <div className="whitespace-pre-wrap">{selectedEvent.description}</div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {selectedEvent && editing && (
                        <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
                            <div>
                                <Label>
                                    タイトル <span className="ml-1 text-red-600">*</span>
                                </Label>
                                <Input
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    required
                                    aria-required="true"
                                />
                                {errors.title && <div className="text-sm text-red-600">{errors.title.join(' ')}</div>}
                            </div>

                            <div>
                                <Label>
                                    カテゴリ <span className="ml-1 text-red-600">*</span>
                                </Label>
                                <select
                                    className="w-full rounded border px-2 py-1"
                                    value={editForm.task_category_id ?? ''}
                                    onChange={(e) => setEditForm({ ...editForm, task_category_id: e.target.value ? Number(e.target.value) : null })}
                                    required
                                    aria-required="true"
                                >
                                    <option value="">-- カテゴリ未選択 --</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.task_category_id && <div className="text-sm text-red-600">{errors.task_category_id.join(' ')}</div>}
                            </div>

                            <div>
                                <Label>説明</Label>
                                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                            </div>

                            {/* 公開設定はステータスの下に移動しました */}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <Label>
                                        開始日時 <span className="ml-1 text-red-600">*</span>
                                    </Label>
                                    <Input
                                        type="datetime-local"
                                        value={editForm.start_at}
                                        onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })}
                                        required
                                        aria-required="true"
                                    />
                                </div>
                                <div>
                                    <Label>終了日時</Label>
                                    <Input
                                        type="datetime-local"
                                        value={editForm.end_at}
                                        onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>
                                    担当者 <span className="ml-1 text-sm text-gray-400"></span>
                                </Label>
                                <MultiSelectCombobox
                                    options={users.map((u) => ({ value: u.id, label: `${u.id} ${u.name}` }))}
                                    selected={editForm.user_ids}
                                    onChange={(vals) => setEditForm({ ...editForm, user_ids: vals })}
                                />
                                {errors.user_ids && <div className="text-sm text-red-600">{errors.user_ids.join(' ')}</div>}
                            </div>

                            <div>
                                <Label>ステータス</Label>
                                <select
                                    className="w-full rounded border px-2 py-1"
                                    value={editForm.status ?? '未着手'}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                >
                                    <option value="未着手">未着手</option>
                                    <option value="進行中">進行中</option>
                                    <option value="完了">完了</option>
                                    <option value="キャンセル">キャンセル</option>
                                    <option value="保留">保留</option>
                                </select>
                            </div>

                            <div>
                                <Label>公開設定</Label>
                                <div className="mt-1 flex items-center gap-3">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="audience"
                                            value="all"
                                            checked={editForm.audience === 'all'}
                                            onChange={() => setEditForm({ ...editForm, audience: 'all' })}
                                        />
                                        <span className="text-sm">全体公開</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="audience"
                                            value="restricted"
                                            checked={editForm.audience === 'restricted'}
                                            onChange={() => setEditForm({ ...editForm, audience: 'restricted' })}
                                        />
                                        <span className="text-sm">限定公開</span>
                                    </label>
                                </div>
                                {editForm.audience === 'restricted' ? (
                                    <div className="mt-2">
                                        <MultiSelectCombobox
                                            options={availableRoles.map((r) => ({ value: r.id, label: r.name }))}
                                            selected={editForm.roles || []}
                                            onChange={(vals) => setEditForm({ ...editForm, roles: vals })}
                                        />
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                                    閉じる
                                </Button>
                                <Button type="submit">更新</Button>
                            </div>
                        </form>
                    )}
                    {!editing && (
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                                閉じる
                            </Button>
                            {selectedEvent && (currentUserId === selectedEvent.user_id || taskPerm.update) ? (
                                <Button onClick={() => startEditFromSelected()}>編集</Button>
                            ) : null}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* 新規登録用ダイアログ */}
            <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
                <DialogContent className="max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>新規タスク登録</DialogTitle>
                        <DialogDescription>新しいタスクを登録します。</DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            // client-side validation: end_at must be >= start_at
                            setFormError(null);
                            setErrors({});
                            if (editForm.start_at && editForm.end_at) {
                                const s = new Date(editForm.start_at);
                                const en = new Date(editForm.end_at);
                                if (en.getTime() < s.getTime()) {
                                    const msg = '終了日時は開始日時以降である必要があります';
                                    setErrors({ end_at: [msg] });
                                    setFormError(msg);
                                    return;
                                }
                            }

                            try {
                                const payload: Record<string, unknown> = { ...editForm };
                                payload.start_at = editForm.start_at ? inputValueToDbDate(editForm.start_at) : null;
                                payload.end_at = editForm.end_at ? inputValueToDbDate(editForm.end_at) : null;
                                payload.user_ids = editForm.user_ids && editForm.user_ids.length > 0 ? editForm.user_ids : null;
                                // include audience and roles explicitly
                                if (editForm.audience) payload.audience = editForm.audience;
                                if (editForm.roles && editForm.roles.length > 0) payload.roles = editForm.roles;
                                const res = await axios.post('/api/tasks', payload);
                                const created =
                                    (res && res.data && (res.data.task || res.data.task === null) ? res.data.task : res.data.task) ||
                                    res.data.task ||
                                    res.data;
                                const mapped = mapApiTaskToTaskEvent(created as ApiTask);
                                // append to events so the calendar shows it immediately
                                setEvents((prev) => [...prev, mapped]);
                                // open detail modal for the new event
                                const s = parseDbDate(mapped.start_at);
                                const en = parseDbDate(mapped.end_at);
                                if (s) {
                                    const placed: PlacedEvent = {
                                        id: mapped.id,
                                        title: mapped.title,
                                        start: s,
                                        end: en ?? new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999),
                                        weekIndex: 0,
                                        startIndex: 0,
                                        endIndex: 0,
                                        row: 0,
                                        color: mapped.category_color ?? null,
                                        description: mapped.description ?? null,
                                        assignees: mapped.assignees ?? [],
                                        category_name: mapped.category_name ?? null,
                                        user_id: mapped.user_id ?? null,
                                        status: mapped.status ?? null,
                                        originalEndMissing: !en,
                                    };
                                    setSelectedEvent(placed);
                                }
                                setToast({ message: res.data.message || '作成しました', type: 'success' });
                                setCreateOpen(false);
                            } catch (err) {
                                const maybeResponse = (err as { response?: unknown } | null)?.response;
                                if (maybeResponse && typeof maybeResponse === 'object' && maybeResponse !== null) {
                                    const data = (maybeResponse as Record<string, unknown>)['data'];
                                    if (data && typeof data === 'object' && data !== null) {
                                        const dataObj = data as Record<string, unknown>;
                                        const errorsVal = dataObj['errors'];
                                        if (errorsVal && typeof errorsVal === 'object') {
                                            setErrors(translateValidationErrors(errorsVal as Record<string, string[]>));
                                            return;
                                        }
                                        if (typeof dataObj['message'] !== 'undefined') {
                                            setFormError(String(dataObj['message']));
                                            return;
                                        }
                                    }
                                }
                                setToast({ message: '通信エラー', type: 'error' });
                            }
                        }}
                        className="space-y-4 py-4"
                    >
                        {formError && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
                        <div>
                            <Label>
                                タイトル <span className="ml-1 text-red-600">*</span>
                            </Label>
                            <Input
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                required
                                aria-required="true"
                            />
                            {errors.title && <div className="text-sm text-red-600">{errors.title.join(' ')}</div>}
                        </div>

                        <div>
                            <Label>
                                カテゴリ <span className="ml-1 text-red-600">*</span>
                            </Label>
                            <select
                                className="w-full rounded border px-2 py-1"
                                value={editForm.task_category_id ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, task_category_id: e.target.value ? Number(e.target.value) : null })}
                                required
                                aria-required="true"
                            >
                                <option value="">-- カテゴリ未選択 --</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            {errors.task_category_id && <div className="text-sm text-red-600">{errors.task_category_id.join(' ')}</div>}
                        </div>

                        <div>
                            <Label>説明</Label>
                            <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label>
                                    開始日時 <span className="ml-1 text-red-600">*</span>
                                </Label>
                                <Input
                                    type="datetime-local"
                                    value={editForm.start_at}
                                    onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })}
                                    required
                                    aria-required="true"
                                />
                            </div>
                            <div>
                                <Label>終了日時</Label>
                                <Input
                                    type="datetime-local"
                                    value={editForm.end_at}
                                    onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>担当者</Label>
                            <MultiSelectCombobox
                                options={users.map((u) => ({ value: u.id, label: `${u.id} ${u.name}` }))}
                                selected={editForm.user_ids}
                                onChange={(vals) => setEditForm({ ...editForm, user_ids: vals })}
                            />
                            {errors.user_ids && <div className="text-sm text-red-600">{errors.user_ids.join(' ')}</div>}
                        </div>

                        <div>
                            <Label>ステータス</Label>
                            <select
                                className="w-full rounded border px-2 py-1"
                                value={editForm.status ?? '未着手'}
                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            >
                                <option value="未着手">未着手</option>
                                <option value="進行中">進行中</option>
                                <option value="完了">完了</option>
                                <option value="キャンセル">キャンセル</option>
                                <option value="保留">保留</option>
                            </select>
                        </div>

                        <div>
                            <Label>公開設定</Label>
                            <div className="mt-1 flex items-center gap-3">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="audience"
                                        value="all"
                                        checked={editForm.audience === 'all'}
                                        onChange={() => setEditForm({ ...editForm, audience: 'all' })}
                                    />
                                    <span className="text-sm">全体公開</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="audience"
                                        value="restricted"
                                        checked={editForm.audience === 'restricted'}
                                        onChange={() => setEditForm({ ...editForm, audience: 'restricted' })}
                                    />
                                    <span className="text-sm">限定公開</span>
                                </label>
                            </div>
                            {editForm.audience === 'restricted' ? (
                                <div className="mt-2">
                                    <MultiSelectCombobox
                                        options={availableRoles.map((r) => ({ value: r.id, label: r.name }))}
                                        selected={editForm.roles || []}
                                        onChange={(vals) => setEditForm({ ...editForm, roles: vals })}
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                                閉じる
                            </Button>
                            <Button type="submit">作成</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* 他N件の一覧を表示するダイアログ */}
            <Dialog open={moreDialogOpen} onOpenChange={(open) => !open && setMoreDialogOpen(false)}>
                <DialogContent className="max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>他{moreList ? moreList.length : 0}件</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">表示したい予定を選択してください</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        {moreList && moreList.length > 0 ? (
                            moreList.map((ev) => (
                                <div key={`more-item-${ev.id}`} className="flex items-center justify-between gap-2">
                                    <button
                                        className="flex items-center gap-2 text-left text-sm hover:text-blue-600"
                                        onClick={() => {
                                            // close this list dialog and open the event detail dialog
                                            setMoreDialogOpen(false);
                                            setMoreList(null);
                                            setSelectedEvent(ev);
                                        }}
                                    >
                                        <span className="mr-1 inline-flex items-center">{getStatusIcon(ev.status)}</span>
                                        <span className="truncate font-medium">{ev.title}</span>
                                        <span className="ml-2 text-xs text-gray-500">
                                            ({formatEventDate(ev.start)}～{formatEventDate(ev.end)})
                                        </span>
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-gray-500">対象の予定はありません</div>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => setMoreDialogOpen(false)}>
                            閉じる
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppSidebarLayout>
    );
}
