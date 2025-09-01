import { BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { CheckCircle, Clock, Edit, Pause, Play, Plus, Trash, X, XCircle } from 'lucide-react';
import { FormEvent, Fragment, useCallback, useEffect, useRef, useState } from 'react';

import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';

type Assignee = { id: number; name: string };

type Task = {
    id: number;
    title: string;
    description?: string;
    start_at?: string | null;
    end_at?: string | null;
    user_id?: number | null; // legacy
    user_ids?: (number | string)[] | null; // canonical
    assignees?: Assignee[]; // enriched by API
    category?: { id: number; name: string; color?: string | null } | null;
    status?: string | null;
};

// Extended task shape when API enriches with audience/roles
type FormState = {
    title: string;
    description: string;
    start_at: string;
    end_at: string;
    user_ids: number[];
    task_category_id?: number | null;
    status?: string | null;
};

const SortableHeader = ({ children, sort_key }: { children: React.ReactNode; sort_key: string }) => {
    const params = new URLSearchParams(window.location.search);
    const currentSort = params.get('sort') || 'created_at';
    const currentDirection = params.get('direction') || 'desc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    return (
        <Link href={route('tasks.index', { sort: sort_key, direction: newDirection })} preserveState preserveScroll>
            <div className={`flex items-center gap-2 ${isCurrentSort ? 'text-indigo-600' : 'text-muted-foreground'}`}>
                <span>{children}</span>
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {isCurrentSort ? (
                        currentDirection === 'asc' ? (
                            <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        )
                    ) : (
                        <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                    )}
                </svg>
            </div>
        </Link>
    );
};

export default function TasksIndexPage() {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'タスク・予定', href: '/tasks' }];

    const [tasks, setTasks] = useState<Task[]>([]);
    const [showForm, setShowForm] = useState(false);
    const formContainerRef = useRef<HTMLDivElement | null>(null);
    const [form, setForm] = useState<FormState>({ title: '', description: '', start_at: '', end_at: '', user_ids: [] });
    const [users, setUsers] = useState<Assignee[]>([]);
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [availableRoles, setAvailableRoles] = useState<{ id: number; name: string }[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [activeRole, setActiveRole] = useState<string | null>(null);
    const [activeAudience, setActiveAudience] = useState<string | null>(null);
    const [audience, setAudience] = useState<'all' | 'restricted'>('all');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [expanded, setExpanded] = useState<number[]>([]);
    const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);
    const [filterAssigneeId, setFilterAssigneeId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const page = usePage<Record<string, unknown>>();
    const taskPerm = (page.props as unknown as { permissions?: { task?: { view: boolean; create: boolean; update: boolean; delete: boolean } } })
        ?.permissions?.task ?? { view: false, create: false, update: false, delete: false };

    const handleDelete = async (id: number) => {
        if (!taskPerm.delete) return;
        const ok = window.confirm('本当にこのタスクを削除しますか？');
        if (!ok) return;
        try {
            const res = await axios.delete(`/api/tasks/${id}`);
            setToast({ message: res && res.data && res.data.message ? res.data.message : '削除しました', type: 'success' });
            fetchTasks();
        } catch (e) {
            setToast({ message: '削除に失敗しました', type: 'error' });
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        (async () => {
            try {
                const ures = await axios.get('/api/active-users');
                setUsers(ures.data.users || []);
                const cres = await axios.get('/api/task-categories');
                setCategories(cres.data.categories || []);
                const rres = await axios.get('/api/roles');
                const roles = rres.data?.roles ?? (Array.isArray(rres.data) ? rres.data : []);
                // keep a raw roles list for mapping ?role= (id -> name) like posts index
                try {
                    // (keep local roles variable for mapping below)
                    const params = new URLSearchParams(window.location.search);
                    const rparam = params.get('role');
                    if (rparam) {
                        if (/^\d+$/.test(rparam)) {
                            const found = (roles as Array<{ id?: number; name?: string }>).find((it) => String(it.id) === rparam);
                            if (found && found.name) setActiveRole(found.name);
                        } else {
                            setActiveRole(rparam);
                        }
                    }
                } catch {
                    // ignore
                }
                // simple filter similar to posts: if user has sysadmin role show all, else only user's roles
                try {
                    const currentUser =
                        (page.props as unknown as { auth?: { user?: { roles?: Array<{ id?: number; name?: string }> } } })?.auth?.user || null;
                    // If server didn't include roles on the shared auth.user, fall back to showing all roles
                    if (!Array.isArray(currentUser?.roles)) {
                        setAvailableRoles(roles as Array<{ id: number; name: string }>);
                    } else {
                        const currentRoleNames = currentUser.roles.map((rr) => rr.name);
                        if (currentRoleNames.includes('システム管理者')) {
                            setAvailableRoles(roles as Array<{ id: number; name: string }>);
                        } else {
                            const currentRoleIds = currentUser.roles.map((rr) => rr.id);
                            setAvailableRoles(
                                (roles as Array<{ id?: number; name?: string }>).filter((r) => currentRoleIds.includes(r.id)) as Array<{
                                    id: number;
                                    name: string;
                                }>,
                            );
                        }
                    }
                } catch {
                    setAvailableRoles(roles);
                }
            } catch {
                // ignore
            }
        })();
    }, []);

    const fetchTasks = useCallback(async () => {
        try {
            const params: Record<string, unknown> = {};
            if (filterAssigneeId) params.user_id = filterAssigneeId;
            // include optional sorting params from URL
            const urlParams = new URLSearchParams(window.location.search);
            const s = urlParams.get('sort');
            const d = urlParams.get('direction');
            if (s) params.sort = s;
            if (d) params.direction = d;
            // use component state for role/audience filters so we don't modify the URL
            if (activeRole) params.role = activeRole;
            if (activeAudience) params.audience = activeAudience;
            const res = await axios.get('/api/tasks', { params });
            let fetched = res.data.tasks || [];
            // note: activeAudience/activeRole are driven by component state elsewhere
            if (filterCategoryId) {
                fetched = fetched.filter((t: Task) => (t.category ? t.category.id === filterCategoryId : false));
            }
            if (filterStatus) {
                fetched = fetched.filter((t: Task) => (t.status ? t.status === filterStatus : false));
            }
            setTasks(fetched);
        } catch (e) {
            console.error(e);
        }
    }, [filterAssigneeId, filterCategoryId, filterStatus, activeRole, activeAudience]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // initialize activeAudience from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const a = params.get('audience');
        if (a) setActiveAudience(a);
    }, []);

    // Re-fetch when Inertia page URL changes (so ?sort=... updates list)
    useEffect(() => {
        fetchTasks();
    }, [page.url]);

    const getStatusIcon = (status?: string | null) => {
        switch (status) {
            case '未着手':
                return <Clock className="inline-block h-3 w-3 text-gray-600" />;
            case '進行中':
                return <Play className="inline-block h-3 w-3 text-blue-700" />;
            case '完了':
                return <CheckCircle className="inline-block h-3 w-3 text-green-700" />;
            case 'キャンセル':
                return <XCircle className="inline-block h-3 w-3 text-red-700" />;
            case '保留':
                return <Pause className="inline-block h-3 w-3 text-yellow-700" />;
            default:
                return null;
        }
    };

    const renderStatusBadge = (status?: string | null, onClick?: () => void) => {
        const base = (content: React.ReactNode) => (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (onClick) onClick();
                }}
                className="inline-flex items-center gap-2 rounded bg-stone-200 px-2 py-0.5 text-xs text-stone-700"
            >
                {content}
            </button>
        );

        if (!status)
            return base(
                <>
                    <span className="mr-0.5">{getStatusIcon(status)}</span>
                    <span>未設定</span>
                </>,
            );

        return base(
            <>
                <span className="mr-0.5">{getStatusIcon(status)}</span>
                <span>{status}</span>
            </>,
        );
    };

    const handleCreateToggle = () => {
        if (!showForm) {
            resetForm();
            setShowForm(true);
        } else {
            setShowForm(false);
        }
        setErrors({});
        setFormError(null);
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({ title: '', description: '', start_at: '', end_at: '', user_ids: [], task_category_id: null, status: '未着手' });
        setFormError(null);
    };

    const startEdit = (t: Task) => {
        setEditingId(t.id);
        setForm({
            title: t.title || '',
            description: t.description || '',
            start_at: t.start_at ? dbDateToInputValue(t.start_at) : '',
            end_at: t.end_at ? dbDateToInputValue(t.end_at) : '',
            // Prefer canonical user_ids; if not present, use enriched assignees array returned by API.
            // Do NOT fall back to legacy single user_id (task creator), to avoid auto-assigning creator as assignee.
            user_ids: Array.isArray(t.user_ids) ? t.user_ids.map((v) => Number(v)) : Array.isArray(t.assignees) ? t.assignees.map((a) => a.id) : [],
            task_category_id: t.category ? t.category.id : null,
            status: t.status || '未着手',
        });
        // set roles/audience when editing if present in payload
        try {
            const anyt = t as any;
            setAudience(anyt.audience || 'all');
            setSelectedRoles(Array.isArray(anyt.roles) ? anyt.roles.map((r: any) => Number(r.id || r)) : []);
        } catch {}
        setShowForm(true);
        setTimeout(() => {
            try {
                formContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch {
                /* ignore */
            }
        }, 120);
    };

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

    const getUserName = (id: number | null | undefined) => {
        if (!id) return '';
        const u = users.find((x) => x.id === Number(id));
        return u ? `${u.name}` : String(id);
    };

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
            const arr = (raw as any)[k] as string[];
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

    const formatDateTime = (raw?: string | null) => {
        if (!raw) return '';
        const d = parseDbDate(raw);
        if (!d) return String(raw);
        const month = d.getMonth() + 1; // no leading zero
        const day = d.getDate(); // no leading zero
        const hour = d.getHours(); // no leading zero for hour
        const minute = String(d.getMinutes()).padStart(2, '0'); // minutes zero-padded
        return `${month}/${day} ${hour}:${minute}`;
    };

    // If endRaw is provided, compute relative to end; otherwise compute relative to startRaw.
    // Color rules: remaining <= 24h -> yellow, remaining > 24h -> blue, passed -> red.
    const getDeadlineBadge = (endRaw?: string | null, startRaw?: string | null) => {
        const now = new Date();
        const dayMs = 1000 * 60 * 60 * 24;
        const hourMs = 1000 * 60 * 60;
        const minuteMs = 1000 * 60;

        const makeBadge = (text: string, tone: 'blue' | 'yellow' | 'red') => {
            if (tone === 'blue') return <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{text}</span>;
            if (tone === 'yellow') return <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{text}</span>;
            return <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{text}</span>;
        };

        if (!endRaw) {
            if (!startRaw) return <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">終了日なし</span>;
            const s = parseDbDate(startRaw);
            if (!s) return <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">終了日不明</span>;
            const diffMs = s.getTime() - now.getTime();
            if (diffMs <= 0) {
                // passed
                const abs = Math.abs(diffMs);
                const daysPast = Math.floor(abs / dayMs);
                if (daysPast >= 1) return makeBadge(`${daysPast}日前`, 'red');
                const hoursPast = Math.floor(abs / hourMs);
                if (hoursPast >= 1) return makeBadge(`${hoursPast}時間前`, 'red');
                const minutesPast = Math.floor(abs / minuteMs);
                return makeBadge(`${minutesPast}分前`, 'red');
            }
            // future or today
            if (diffMs <= 24 * hourMs) {
                // within 24 hours -> yellow
                const hours = Math.floor(diffMs / hourMs);
                if (hours >= 1) return makeBadge(`あと${hours}時間`, 'yellow');
                const minutes = Math.floor(diffMs / minuteMs);
                return makeBadge(`あと${minutes}分`, 'yellow');
            }
            // more than 24 hours -> blue, show days
            const days = Math.floor(diffMs / dayMs);
            return makeBadge(`あと${days}日`, 'blue');
        }

        const d = parseDbDate(endRaw);
        if (!d) return <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">終了日不明</span>;
        const diffMs = d.getTime() - now.getTime();
        if (diffMs <= 0) {
            const abs = Math.abs(diffMs);
            const daysPast = Math.floor(abs / dayMs);
            if (daysPast >= 1) return makeBadge(`${daysPast}日前`, 'red');
            const hoursPast = Math.floor(abs / hourMs);
            if (hoursPast >= 1) return makeBadge(`${hoursPast}時間前`, 'red');
            const minutesPast = Math.floor(abs / minuteMs);
            return makeBadge(`${minutesPast}分前`, 'red');
        }
        if (diffMs <= 24 * hourMs) {
            const hours = Math.floor(diffMs / hourMs);
            if (hours >= 1) return makeBadge(`あと${hours}時間`, 'yellow');
            const minutes = Math.floor(diffMs / minuteMs);
            return makeBadge(`あと${minutes}分`, 'yellow');
        }
        const days = Math.floor(diffMs / dayMs);
        return makeBadge(`あと${days}日`, 'blue');
    };

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

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // client-side validation: end_at must be >= start_at
        setFormError(null);
        setErrors({});
        if (form.start_at && form.end_at) {
            const s = new Date(form.start_at);
            const en = new Date(form.end_at);
            if (en.getTime() < s.getTime()) {
                const msg = '終了日時は開始日時以降である必要があります';
                setErrors({ end_at: [msg] });
                setFormError(msg);
                return;
            }
        }

        try {
            const payload: Partial<FormState> & { id?: number } = { ...form };
            if (editingId) payload.id = editingId;
            // include audience and roles similar to posts
            (payload as any).audience = audience;
            if (audience === 'restricted') {
                (payload as any).roles = selectedRoles;
            }
            // If no assignees selected, explicitly send null so server clears assignments.
            if (!payload.user_ids || payload.user_ids.length === 0) {
                (payload as any).user_ids = null;
            }
            if (!payload.task_category_id) payload.task_category_id = null;
            const res = await axios.post('/api/tasks', payload);
            setToast({ message: res.data.message || (editingId ? '更新しました' : '作成しました'), type: 'success' });
            setShowForm(false);
            resetForm();
            fetchTasks();
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
                        // show server message inside form
                        setFormError(String(dataObj['message']));
                        return;
                    }
                }
            }
            setToast({ message: '通信エラー', type: 'error' });
        }
    };

    // category color helpers: background color and readable text color
    const getCategoryStyle = (cat?: { id: number; name: string; color?: string | null }) => {
        const defaultBg = '#cffafe'; // cyan-100 fallback
        if (!cat || !cat.color) return { background: defaultBg, color: '#075985' };
        const bg = cat.color;
        try {
            const c = bg.replace('#', '');
            const r = parseInt(c.substring(0, 2), 16);
            const g = parseInt(c.substring(2, 4), 16);
            const b = parseInt(c.substring(4, 6), 16);
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const text = luminance > 160 ? '#000000' : '#ffffff';
            return { background: bg, color: text };
        } catch {
            return { background: bg, color: '#ffffff' };
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="タスク・予定" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-4 flex flex-wrap items-start justify-between">
                    <div>
                        <Heading title="タスク・予定" description="タスクの一覧・作成" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
                        <Link href={route('tasks.calendar')}>
                            <Button variant="ghost">カレンダー</Button>
                        </Link>
                        <Link href={route('tasks.categories.index')}>
                            <Button variant="ghost">カテゴリ編集</Button>
                        </Link>
                        <Button className="flex items-center gap-2" onClick={() => handleCreateToggle()} disabled={!taskPerm.create}>
                            <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">{showForm ? 'フォームを閉じる' : '新規登録'}</span>
                        </Button>
                    </div>
                </div>

                {showForm && (
                    <div className="mb-6 flex justify-center" ref={formContainerRef}>
                        <div className="w-full lg:w-2/3">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle>{editingId ? '編集' : '新規タスク・予定作成'}</CardTitle>
                                        <Button variant="ghost" className="p-1" onClick={() => setShowForm(false)} aria-label="閉じる">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {formError && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
                                        <div>
                                            <Label>
                                                タイトル <span className="ml-1 text-red-600">*</span>
                                            </Label>
                                            <Input
                                                value={form.title}
                                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                                aria-required="true"
                                                required
                                            />
                                            {errors.title && <div className="text-sm text-red-600">{errors.title.join(' ')}</div>}
                                        </div>
                                        <div>
                                            <Label>
                                                カテゴリ <span className="ml-1 text-red-600">*</span>
                                            </Label>
                                            <select
                                                className="w-full rounded border px-2 py-1"
                                                value={form.task_category_id ?? ''}
                                                onChange={(e) =>
                                                    setForm({ ...form, task_category_id: e.target.value ? Number(e.target.value) : null })
                                                }
                                                aria-required="true"
                                                required
                                            >
                                                <option value="">-- カテゴリ選択 --</option>
                                                {categories.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.task_category_id && (
                                                <div className="text-sm text-red-600">{errors.task_category_id.join(' ')}</div>
                                            )}
                                        </div>
                                        <div>
                                            <Label>説明</Label>
                                            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label>
                                                    開始日時 <span className="ml-1 text-red-600">*</span>
                                                </Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={form.start_at}
                                                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                                                    aria-required="true"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label>終了日時</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={form.end_at}
                                                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <Label>
                                                担当者 <span className="ml-1 text-sm text-gray-400"></span>
                                            </Label>
                                            <MultiSelectCombobox
                                                options={users.map((u) => ({ value: u.id, label: `${u.id} ${u.name}` }))}
                                                selected={form.user_ids}
                                                onChange={(vals) => setForm({ ...form, user_ids: vals })}
                                            />
                                            {errors.user_ids && <div className="text-sm text-red-600">{errors.user_ids.join(' ')}</div>}
                                        </div>
                                        <div>
                                            <Label>ステータス</Label>
                                            <select
                                                className="w-full rounded border px-2 py-0.5"
                                                value={form.status ?? '未着手'}
                                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                            >
                                                <option value="未着手">未着手</option>
                                                <option value="進行中">進行中</option>
                                                <option value="完了">完了</option>
                                                <option value="キャンセル">キャンセル</option>
                                                <option value="保留">保留</option>
                                            </select>
                                        </div>

                                        <div>
                                            <Label>公開範囲</Label>
                                            <div className="flex items-center gap-4">
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="audience"
                                                        value="all"
                                                        checked={audience === 'all'}
                                                        onChange={() => setAudience('all')}
                                                    />
                                                    <span className="text-sm">全員に公開</span>
                                                </label>
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="audience"
                                                        value="restricted"
                                                        checked={audience === 'restricted'}
                                                        onChange={() => setAudience('restricted')}
                                                    />
                                                    <span className="text-sm">特定のロールのみ</span>
                                                </label>
                                            </div>
                                        </div>

                                        {audience === 'restricted' && (
                                            <div>
                                                <Label>公開するロール</Label>
                                                <MultiSelectCombobox
                                                    options={availableRoles.map((r) => ({ value: r.id, label: r.name }))}
                                                    selected={selectedRoles}
                                                    onChange={(vals) => setSelectedRoles(vals)}
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-2">
                                            <Button type="submit">{editingId ? '更新' : '登録'}</Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                <div>
                    {tasks.length === 0 ? (
                        <div className="text-sm text-gray-500">タスクはありません</div>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>一覧</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {/* Active filters */}
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    {filterCategoryId && (
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="inline-block rounded bg-cyan-100 px-2 py-0.5 text-xs text-cyan-800">
                                                カテゴリ: {categories.find((c) => c.id === filterCategoryId)?.name}
                                            </span>
                                            <button className="text-xs text-gray-500" onClick={() => setFilterCategoryId(null)}>
                                                クリア
                                            </button>
                                        </div>
                                    )}
                                    {activeRole && (
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="inline-block rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">
                                                ロール: {activeRole}
                                            </span>
                                            <button
                                                className="text-xs text-gray-500"
                                                onClick={() => {
                                                    setActiveRole(null);
                                                    fetchTasks();
                                                }}
                                            >
                                                クリア
                                            </button>
                                        </div>
                                    )}
                                    {activeAudience && (
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span
                                                className={
                                                    `inline-block rounded px-2 py-0.5 text-xs ` +
                                                    (activeAudience === 'all' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800')
                                                }
                                            >
                                                {activeAudience === 'all' ? '全体公開' : '限定公開'}
                                            </span>
                                            <button
                                                className="text-xs text-gray-500"
                                                onClick={() => {
                                                    setActiveAudience(null);
                                                    fetchTasks();
                                                }}
                                            >
                                                クリア
                                            </button>
                                        </div>
                                    )}
                                    {filterAssigneeId && (
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
                                                担当者: {users.find((u) => u.id === filterAssigneeId)?.name}
                                            </span>
                                            <button className="text-xs text-gray-500" onClick={() => setFilterAssigneeId(null)}>
                                                クリア
                                            </button>
                                        </div>
                                    )}
                                    {filterStatus && (
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="inline-block rounded bg-stone-200 px-2 py-0.5 text-xs text-stone-700">
                                                ステータス: {filterStatus}
                                            </span>
                                            <button className="text-xs text-gray-500" onClick={() => setFilterStatus(null)}>
                                                クリア
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="mb-2 text-left text-xs text-gray-500 md:hidden">
                                    絞り込み可能な項目: カテゴリ / 担当者 / ステータス（各バッジをタップして絞り込み）
                                </div>
                                <div className="space-y-3 md:hidden">
                                    {tasks.map((t) => {
                                        const isExpanded = expanded.includes(t.id);
                                        return (
                                            <div key={`m-${t.id}`} className={`rounded border p-3 ${isExpanded ? 'bg-gray-50' : ''}`}>
                                                <div
                                                    className="flex cursor-pointer items-start justify-between gap-3"
                                                    onClick={() => {
                                                        setExpanded((prev) =>
                                                            prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                                                        );
                                                    }}
                                                >
                                                    <div className="flex-1">
                                                        <div className="text-sm text-gray-600">
                                                            # {t.id} ・ {getUserName(t.user_id)}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            {t.category ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setFilterCategoryId((prev) =>
                                                                            prev === t.category!.id ? null : t.category!.id,
                                                                        );
                                                                    }}
                                                                    className="inline-block rounded px-2 py-0.5 text-xs"
                                                                    style={getCategoryStyle(t.category)}
                                                                >
                                                                    {t.category.name}
                                                                </button>
                                                            ) : null}
                                                            {renderStatusBadge(t.status, () =>
                                                                setFilterStatus((prev: string | null) =>
                                                                    prev === (t.status ?? null) ? null : (t.status ?? null),
                                                                ),
                                                            )}
                                                        </div>
                                                        <div className="mt-1 font-medium">{t.title}</div>
                                                        <div className="mt-1 text-sm text-gray-500">
                                                            <div className="flex items-center gap-2">
                                                                <div>
                                                                    {formatDateTime(t.start_at)}～{formatDateTime(t.end_at)}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {t.status === '完了' ? null : getDeadlineBadge(t.end_at, t.start_at)}
                                                                </div>
                                                            </div>
                                                            <div className="mt-1 text-sm">
                                                                {t.assignees && t.assignees.length > 0 ? (
                                                                    t.assignees.map((a: Assignee) => (
                                                                        <button
                                                                            key={`a-m-${a.id}-${t.id}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setFilterAssigneeId((prev) => (prev === a.id ? null : a.id));
                                                                            }}
                                                                            className="mr-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800"
                                                                        >
                                                                            {a.name}
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-sm text-gray-500">担当者なし</span>
                                                                )}
                                                                {/* mobile: show audience and role badges under assignees */}
                                                                <div className="mt-2">
                                                                    {(() => {
                                                                        const aud = (t as any).audience;
                                                                        const roles = ((t as any).roles || (t as any).role || []) as Array<{
                                                                            id?: number;
                                                                            name?: string;
                                                                        }>;
                                                                        if (aud === 'all') {
                                                                            return (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveAudience('all');
                                                                                        fetchTasks();
                                                                                    }}
                                                                                    className="inline-flex items-center gap-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800"
                                                                                >
                                                                                    全体公開
                                                                                </button>
                                                                            );
                                                                        }
                                                                        if (aud === 'restricted') {
                                                                            return (
                                                                                <div>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setActiveAudience('restricted');
                                                                                            fetchTasks();
                                                                                        }}
                                                                                        className="inline-flex items-center gap-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800"
                                                                                    >
                                                                                        限定公開
                                                                                    </button>
                                                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                                                        {roles && roles.length > 0 ? (
                                                                                            roles.map((r) => (
                                                                                                <button
                                                                                                    key={r.id || r.name}
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        setActiveRole(String(r.name ?? r.id));
                                                                                                        fetchTasks();
                                                                                                    }}
                                                                                                    className="cursor-pointer rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800"
                                                                                                >
                                                                                                    {r.name}
                                                                                                </button>
                                                                                            ))
                                                                                        ) : (
                                                                                            <span className="text-sm text-gray-500">
                                                                                                (対象未指定)
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 flex-col items-end gap-2">
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    startEdit(t);
                                                                }}
                                                                disabled={!taskPerm.update}
                                                            >
                                                                <Edit className="h-4 w-4 sm:mr-2" />
                                                                <span className="hidden sm:inline">編集</span>
                                                            </Button>
                                                            {taskPerm.delete && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDelete(t.id);
                                                                    }}
                                                                    className="p-2"
                                                                >
                                                                    <Trash className="h-4 w-4 md:mr-2" />
                                                                    <span className="hidden sm:inline">削除</span>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="mt-3">
                                                        <div className="mb-2 font-medium">内容</div>
                                                        <div className="whitespace-pre-wrap text-gray-700">{t.description || '-'}</div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="hidden w-full overflow-x-auto md:block">
                                    <table className="w-full table-auto">
                                        <caption className="mb-2 text-left text-xs text-gray-500">
                                            絞り込み可能な項目: カテゴリ / 担当者 / ステータス（各バッジをクリックして絞り込み）
                                        </caption>
                                        <thead>
                                            <tr className="border-b border-gray-200 text-left text-sm text-muted-foreground">
                                                <th className="p-2">
                                                    <SortableHeader sort_key="id">ID</SortableHeader>
                                                </th>
                                                <th className="p-2">
                                                    <SortableHeader sort_key="user_id">作成者</SortableHeader>
                                                </th>
                                                <th className="p-2">
                                                    <SortableHeader sort_key="task_category_id">カテゴリ</SortableHeader>
                                                </th>
                                                <th className="p-2">
                                                    <SortableHeader sort_key="title">タイトル</SortableHeader>
                                                </th>
                                                <th className="p-2">
                                                    <SortableHeader sort_key="start_at">期間</SortableHeader>
                                                </th>
                                                <th className="p-2">
                                                    <SortableHeader sort_key="assignee">担当者</SortableHeader>
                                                </th>
                                                <th className="p-2">
                                                    <SortableHeader sort_key="status">ステータス</SortableHeader>
                                                </th>
                                                <th className="p-2">
                                                    <SortableHeader sort_key="audience">公開設定</SortableHeader>
                                                </th>
                                                <th className="p-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tasks.map((t) => {
                                                const isExpanded = expanded.includes(t.id);
                                                return (
                                                    <Fragment key={`group-${t.id}`}>
                                                        <tr
                                                            key={`row-${t.id}`}
                                                            className={`border-b hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''} cursor-pointer`}
                                                            onClick={() =>
                                                                setExpanded((prev) =>
                                                                    prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                                                                )
                                                            }
                                                        >
                                                            <td className="p-2 align-middle text-sm">{t.id}</td>
                                                            <td className="p-2 align-middle text-sm">{getUserName(t.user_id)}</td>
                                                            <td className="p-2 align-middle text-sm">
                                                                {t.category ? (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setFilterCategoryId((prev) =>
                                                                                prev === t.category!.id ? null : t.category!.id,
                                                                            );
                                                                        }}
                                                                        className="inline-block rounded px-2 py-0.5 text-xs"
                                                                        style={getCategoryStyle(t.category)}
                                                                    >
                                                                        {t.category.name}
                                                                    </button>
                                                                ) : (
                                                                    ''
                                                                )}
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">{t.title}</td>
                                                            <td className="p-2 align-middle text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <div>
                                                                        {formatDateTime(t.start_at)}～{formatDateTime(t.end_at)}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {t.status === '完了' ? null : getDeadlineBadge(t.end_at, t.start_at)}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">
                                                                {t.assignees && t.assignees.length > 0 ? (
                                                                    t.assignees.map((a: Assignee) => (
                                                                        <button
                                                                            key={`a-${a.id}-${t.id}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setFilterAssigneeId((prev) => (prev === a.id ? null : a.id));
                                                                            }}
                                                                            className="mr-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800"
                                                                        >
                                                                            {a.name}
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-sm text-gray-500">担当者なし</span>
                                                                )}
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">
                                                                {renderStatusBadge(t.status, () =>
                                                                    setFilterStatus((prev: string | null) =>
                                                                        prev === (t.status ?? null) ? null : (t.status ?? null),
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">
                                                                {(() => {
                                                                    const aud = (t as any).audience;
                                                                    const roles = ((t as any).roles || (t as any).role || []) as Array<{
                                                                        id?: number;
                                                                        name?: string;
                                                                    }>;
                                                                    if (aud === 'all') {
                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveAudience('all');
                                                                                    fetchTasks();
                                                                                }}
                                                                                className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-green-200 hover:opacity-95 hover:shadow-sm"
                                                                            >
                                                                                <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                                                                                    全体公開
                                                                                </span>
                                                                            </button>
                                                                        );
                                                                    }
                                                                    if (aud === 'restricted') {
                                                                        return (
                                                                            <div>
                                                                                <div>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setActiveAudience('restricted');
                                                                                            fetchTasks();
                                                                                        }}
                                                                                        className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-purple-200 hover:opacity-95 hover:shadow-sm"
                                                                                    >
                                                                                        <span className="inline-block rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                                                                                            限定公開
                                                                                        </span>
                                                                                    </button>
                                                                                </div>
                                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                                    {roles && roles.length > 0 ? (
                                                                                        roles.map((r) => (
                                                                                            <button
                                                                                                key={r.id || r.name}
                                                                                                type="button"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    // prefer role name for display (not id)
                                                                                                    setActiveRole(String(r.name ?? r.id));
                                                                                                    fetchTasks();
                                                                                                }}
                                                                                                className="cursor-pointer rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800 transition duration-150 hover:bg-gray-200"
                                                                                            >
                                                                                                {r.name}
                                                                                            </button>
                                                                                        ))
                                                                                    ) : (
                                                                                        <span className="text-sm text-gray-500">(対象未指定)</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return <span className="text-sm text-muted-foreground">—</span>;
                                                                })()}
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            startEdit(t);
                                                                        }}
                                                                        disabled={!taskPerm.update}
                                                                    >
                                                                        <Edit className="h-4 w-4 sm:mr-2" />
                                                                        <span className="hidden sm:inline">編集</span>
                                                                    </Button>
                                                                    {taskPerm.delete && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="destructive"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDelete(t.id);
                                                                            }}
                                                                        >
                                                                            <Trash className="mr-2 h-4 w-4" /> 削除
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr key={`expanded-${t.id}`} className="bg-gray-50">
                                                                <td colSpan={7} className="p-4">
                                                                    <div className="text-sm">
                                                                        <div className="mb-2 font-medium">内容</div>
                                                                        <div className="whitespace-pre-wrap text-gray-700">
                                                                            {t.description || '-'}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppSidebarLayout>
    );
}
