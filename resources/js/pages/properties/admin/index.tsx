import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import axios, { type AxiosResponse } from 'axios';
import { Edit, GripVertical, Plus, Trash } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

// helper: narrow axios-like error with response.status
function isAxiosErrorWithStatus(err: unknown, status: number): err is { response: { status: number; data?: unknown } } {
    if (typeof err !== 'object' || err === null) return false;
    const candidate = err as { response?: { status?: number; data?: unknown } };
    return typeof candidate.response?.status === 'number' && candidate.response.status === status;
}

interface Agent {
    id: number;
    name: string;
    order_column?: number | null;
}

interface Property {
    id: number;
    real_estate_agent_id?: number | null;
    name: string;
    postcode?: string | null;
    address?: string | null;
    parking?: number | null;
    layout?: string | null;
    room_details?: string | null;
    contract_date?: string | null;
    termination_date?: string | null;
    memo?: string | null;
    key_returned?: number | null;
    order_column?: number | null;
}

interface Furniture {
    id: number;
    name: string;
    order_column?: number | null;
}

// Reusable sortable header for server-side sorting. It will add `list` query so server knows which tab requested sort.
const SortableHeader = ({
    children,
    sort_key,
    queryParams,
    listName,
}: {
    children: React.ReactNode;
    sort_key: string;
    queryParams?: Record<string, string> | null;
    listName: string;
}) => {
    const currentSort = (queryParams && ('sort' in queryParams ? (queryParams as Record<string, string>).sort : undefined)) || new URLSearchParams(window.location.search).get('sort') || '';
    const currentDirection = (queryParams && ('direction' in queryParams ? (queryParams as Record<string, string>).direction : undefined)) || new URLSearchParams(window.location.search).get('direction') || 'asc';
    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    const href = (() => {
        try {
            if (typeof route === 'function') {
                try {
                    return route('properties.admin', { sort: sort_key, direction: newDirection, list: listName });
                } catch {
                    // ignore and fall through to manual URL
                }
            }
            const u = new URL(window.location.href);
            u.searchParams.set('sort', sort_key);
            u.searchParams.set('direction', newDirection);
            u.searchParams.set('list', listName);
            return u.pathname + u.search;
        } catch {
            return `?sort=${encodeURIComponent(sort_key)}&direction=${encodeURIComponent(newDirection)}&list=${encodeURIComponent(listName)}`;
        }
    })();

    return (
        <Link href={href} preserveState preserveScroll method="get">
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

export default function Index({
    agents,
    properties,
    furnitures,
    queryParams = {},
}: {
    agents: Agent[];
    properties: Property[];
    furnitures: Furniture[];
    queryParams?: Record<string, string>;
}) {
    const page = usePage();
    const pageCan = (page.props as unknown as { can?: Record<string, Record<string, boolean>> }).can || {
        properties: { viewAny: true, create: true, update: true, delete: true, reorder: true },
    };
    const canProperties = pageCan.properties || { viewAny: true, create: true, update: true, delete: true, reorder: true };
    // fallback when controller didn't supply queryParams
    const pageProps = page.props as unknown as { queryParams?: Record<string, string> };
    // property_furnitures_map may be provided by the controller: { [property_id]: [furniture_master_id, ...] }
    const pagePropsAll = page.props as unknown as {
        property_furnitures_map?: Record<number, number[]>;
        property_furnitures_details?: Record<number, import('@/types').PropertyFurniture[]>;
    };
    const rawPropertyFurnituresMap = pagePropsAll.property_furnitures_map;
    const rawPropertyFurnituresDetails = pagePropsAll.property_furnitures_details;
    const propertyFurnituresMap = useMemo(() => (rawPropertyFurnituresMap as Record<number, number[]>) || {}, [rawPropertyFurnituresMap]);
    const propertyFurnituresDetails = useMemo(
        () => (rawPropertyFurnituresDetails as Record<number, import('@/types').PropertyFurniture[]>) || {},
        [rawPropertyFurnituresDetails],
    );
    // keep local, editable copies so UI can update without full page reload
    const initialPropertyFurnituresMap = propertyFurnituresMap;
    const initialPropertyFurnituresDetails = propertyFurnituresDetails;
    const [propertyFurnituresMapState, setPropertyFurnituresMapState] = useState<Record<number, number[]>>(initialPropertyFurnituresMap || {});
    const [propertyFurnituresDetailsState, setPropertyFurnituresDetailsState] = useState<Record<number, import('@/types').PropertyFurniture[]>>(
        initialPropertyFurnituresDetails || {},
    );
    // accordion open state for property rows
    const [openPropertyId, setOpenPropertyId] = useState<number | null>(null);

    const togglePropertyOpen = (id: number) => setOpenPropertyId((prev) => (prev === id ? null : id));

    // helper to render registered furniture list for a given property id (one-line labels with 搬出日)
    const renderPropertyFurnitureList = (propertyId: number) => {
        const list = (propertyFurnituresDetailsState[propertyId] || []).slice();
        // sort same as elsewhere
        list.sort((a, b) => {
            const ma = furnituresList.find((f) => f.id === a.furniture_master_id);
            const mb = furnituresList.find((f) => f.id === b.furniture_master_id);
            const oa = ma && typeof ma.order_column === 'number' ? ma.order_column : Number.MAX_SAFE_INTEGER;
            const ob = mb && typeof mb.order_column === 'number' ? mb.order_column : Number.MAX_SAFE_INTEGER;
            if (oa !== ob) return oa - ob;
            return (a.furniture_master_id || 0) - (b.furniture_master_id || 0);
        });

        const formatYmd = (v?: string) => (v ? new Date(v).toISOString().slice(0, 10).replace(/-/g, '/') : null);

        if (list.length === 0) {
            return <div className="text-sm text-muted-foreground">家具は登録されていません</div>;
        }

        return (
            <div className={list.length >= 8 ? 'max-h-64 space-y-2 overflow-y-auto pr-2' : 'space-y-2'}>
                {list.map((row: import('@/types').PropertyFurniture) => {
                    const master = furnituresList.find((f) => f.id === row.furniture_master_id);
                    const start = formatYmd(row.removal_start_date as string | undefined);
                    const end = row.removal_date
                        ? formatYmd(row.removal_date as string | undefined) || new Date(row.removal_date).toLocaleDateString()
                        : null;

                    return (
                        <div
                            key={row.id}
                            className="w-full rounded-md border px-3 py-2 hover:bg-gray-50"
                            role="group"
                            aria-label={`家具 ${master ? master.name : '—'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="truncate text-sm font-medium text-foreground">{master ? master.name : '—'}</div>
                                        <div className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground">個数: {row.quantity}</div>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {start && <div className="block md:mr-2 md:inline">搬出開始: {start}</div>}
                                        {end && <div className="block md:inline">搬出日: {end}</div>}
                                        {!start && !end && <div className="block">搬出日: 未設定</div>}
                                    </div>
                                </div>

                                {/* 編集・削除ボタンはモバイル表示では不要のため省略 */}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };
    const qp = (
        queryParams && Object.keys(queryParams).length > 0
            ? queryParams
            : pageProps.queryParams || Object.fromEntries(new URLSearchParams(window.location.search).entries())
    ) as Record<string, string>;
    const [tab, setTab] = useState<'agents' | 'properties' | 'furnitures'>('agents');
    const [showCreate, setShowCreate] = useState(false);
    const [editMode, setEditMode] = useState<{ type: 'agent' | 'property' | 'furniture'; id: number } | null>(null);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    // local lists derived from initial props so we can update UI without page reload
    const [agentsList, setAgentsList] = useState<Agent[]>(agents || []);
    const [propertiesList, setPropertiesList] = useState<Property[]>(properties || []);
    const [furnituresList, setFurnituresList] = useState<Furniture[]>(furnitures || []);

    // Keep local lists in sync with Inertia props when the page updates (e.g., after server-side sorting)
    // Also watch page.url because Inertia visits update the URL even if props reference equality holds.
    const pageUrl = (page as unknown as { url?: string }).url;
    useEffect(() => {
        setAgentsList(agents || []);
    }, [agents, pageUrl]);
    useEffect(() => {
        setPropertiesList(properties || []);
    }, [properties, pageUrl]);
    useEffect(() => {
        setFurnituresList(furnitures || []);
    }, [furnitures, pageUrl]);
    // sync property furniture data when page props change
    useEffect(() => {
        setPropertyFurnituresMapState(propertyFurnituresMap || {});
        setPropertyFurnituresDetailsState(propertyFurnituresDetails || {});
    }, [pageUrl, propertyFurnituresMap, propertyFurnituresDetails]);

    // Restore active tab from query param `list` on mount (or when qp changes)
    useEffect(() => {
        const fromQp = (qp && qp.list) || new URLSearchParams(window.location.search).get('list');
        if (fromQp === 'agents' || fromQp === 'properties' || fromQp === 'furnitures') {
            setTab(fromQp);
        }
    }, [/* run on mount and when qp is available */ qp]);

    // Helper: change tab and update URL `list` param without reloading
    const handleTabChange = (newTab: 'agents' | 'properties' | 'furnitures') => {
        setTab(newTab);
        // close any open create/edit form when switching tabs
        setShowCreate(false);
        setEditMode(null);
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('list', newTab);
            // preserve existing sort/direction if present
            history.replaceState({}, '', u.pathname + u.search);
        } catch {
            // ignore
        }
    };

    // drag & drop state for reorder
    const dragState = {
        draggingId: null as number | null,
    };

    const onDragStart = (e: React.DragEvent, id: number) => {
        dragState.draggingId = id;
        try {
            e.dataTransfer?.setData('text/plain', String(id));
            e.dataTransfer?.setData('application/json', JSON.stringify({ id }));
            // allow move
            e.dataTransfer!.effectAllowed = 'move';
        } catch {
            // ignore
        }
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
    };

    const reorderOnDrop = async (e: React.DragEvent, targetId: number, listName: 'agents' | 'properties' | 'furnitures') => {
        e.preventDefault();
        const srcIdStr = (e.dataTransfer?.getData('text/plain') as string) || String(dragState.draggingId ?? '');
        const srcId = Number(srcIdStr);
        if (!srcId || srcId === targetId) return;

        // helper to update local list optimistically
        const performReorder = <T extends { id: number; order_column?: number | null }>(arr: T[]): T[] => {
            const ids = arr.map((it) => it.id);
            const movingIndex = ids.indexOf(srcId);
            const targetIndex = ids.indexOf(targetId);
            if (movingIndex === -1 || targetIndex === -1) return arr;
            const copy = [...arr];
            const [moving] = copy.splice(movingIndex, 1);
            copy.splice(targetIndex, 0, moving);
            // update order_column to reflect new index while preserving other fields
            return copy.map((it, idx) => ({ ...it, order_column: idx }) as T);
        };

        if (listName === 'agents') {
            const prev = agentsList;
            const next = performReorder(prev);
            setAgentsList(next);
            const ids = next.map((it) => it.id);
            try {
                await axios.post(safeRoute('properties.masters.real-estate-agents.reorder', '/properties/masters/real-estate-agents/reorder'), {
                    order: ids,
                });
                setToast({ message: '並び替えを保存しました', type: 'success' });
                setTimeout(() => setToast(null), 3000);
            } catch {
                setAgentsList(prev); // rollback
                setToast({ message: '並び替えを保存できませんでした', type: 'error' });
                setTimeout(() => setToast(null), 3000);
            }
        } else if (listName === 'properties') {
            const prev = propertiesList;
            const next = performReorder(prev);
            setPropertiesList(next);
            const ids = next.map((it) => it.id);
            try {
                await axios.post(safeRoute('properties.masters.properties.reorder', '/properties/masters/properties/reorder'), { order: ids });
                setToast({ message: '並び替えを保存しました', type: 'success' });
                setTimeout(() => setToast(null), 3000);
            } catch {
                setPropertiesList(prev);
                setToast({ message: '並び替えを保存できませんでした', type: 'error' });
                setTimeout(() => setToast(null), 3000);
            }
        } else if (listName === 'furnitures') {
            const prev = furnituresList;
            const next = performReorder(prev);
            setFurnituresList(next);
            const ids = next.map((it) => it.id);
            try {
                await axios.post(safeRoute('properties.masters.furniture-masters.reorder', '/properties/masters/furniture-masters/reorder'), {
                    order: ids,
                });
                setToast({ message: '並び替えを保存しました', type: 'success' });
                setTimeout(() => setToast(null), 3000);
            } catch {
                setFurnituresList(prev);
                setToast({ message: '並び替えを保存できませんでした', type: 'error' });
                setTimeout(() => setToast(null), 3000);
            }
        }

        dragState.draggingId = null;
    };
    // form state
    const [agentForm, setAgentForm] = useState<{ name: string; order_column: string }>({ name: '', order_column: '' });
    const [furnitureForm, setFurnitureForm] = useState<{ name: string; order_column: string }>({ name: '', order_column: '' });
    type PropertyForm = {
        real_estate_agent_id: number | null;
        name: string;
        postcode: string;
        address: string;
        parking: string;
        layout: string;
        room_details: string;
        contract_date: string;
        termination_date: string;
        memo: string;
        key_returned: string;
        order_column: string;
    };
    const [propertyForm, setPropertyForm] = useState<PropertyForm>({
        real_estate_agent_id: null,
        name: '',
        postcode: '',
        address: '',
        parking: '0',
        layout: '',
        room_details: '',
        contract_date: new Date().toISOString().slice(0, 10),
        termination_date: '',
        memo: '',
        key_returned: '0',
        order_column: '',
    });

    // property furniture form state (shown when editing a property)
    const [propertyFurnitureForm, setPropertyFurnitureForm] = useState<{
        id?: number | null;
        property_id: number | null;
        furniture_master_id: number | null;
        quantity: number | string;
        removal_start_date: string;
        removal_date: string;
    }>({
        id: null,
        property_id: null,
        furniture_master_id: null,
        quantity: 0,
        removal_start_date: '',
        removal_date: '',
    });

    const isPropertyEdit = !!(editMode && editMode.type === 'property');

    const safeRoute = (name: string, fallback: string) => {
        try {
            // route may be injected globally by Ziggy at runtime; use defensive check
            return typeof route === 'function' ? route(name) : fallback;
        } catch {
            return fallback;
        }
    };

    // derived registered furniture list for the current editing property (used to control scroll behavior)
    const registeredFurnitureList = (
        (propertyFurnituresDetailsState[Number(editMode?.id ?? propertyFurnitureForm.property_id ?? -1)] ||
            []) as import('@/types').PropertyFurniture[]
    )
        .slice()
        .sort((a, b) => {
            const ma = furnituresList.find((f) => f.id === a.furniture_master_id);
            const mb = furnituresList.find((f) => f.id === b.furniture_master_id);
            const oa = ma && typeof ma.order_column === 'number' ? ma.order_column : Number.MAX_SAFE_INTEGER;
            const ob = mb && typeof mb.order_column === 'number' ? mb.order_column : Number.MAX_SAFE_INTEGER;
            if (oa !== ob) return oa - ob;
            // fallback stable ordering by furniture id
            return (a.furniture_master_id || 0) - (b.furniture_master_id || 0);
        });

    return (
        <AppSidebarLayout
            breadcrumbs={[
                { title: '物件管理', href: '/properties' },
                { title: '物件マスタ管理', href: '/properties/admin' },
            ]}
        >
            <Head title="物件マスタ管理" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <div className="flex items-start justify-between">
                        <HeadingSmall title="物件マスタ管理" description="物件・不動産会社・家具の管理" />
                        <div className="mt-1 ml-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    try {
                                        window.history.back();
                                    } catch {
                                        // ignore
                                    }
                                }}
                            >
                                戻る
                            </Button>
                        </div>
                    </div>

                    {/* 中央配置のタブナビ */}
                    <div className="mt-4 flex justify-start">
                        <nav className="inline-flex rounded-t-lg bg-gray-100 shadow-sm" role="tablist" aria-label="物件マスタタブ">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === 'agents'}
                                onClick={() => handleTabChange('agents')}
                                className={
                                    '-mb-px border-b-2 px-4 py-2 focus:outline-none ' +
                                    (tab === 'agents'
                                        ? 'border-indigo-600 bg-white font-medium text-indigo-700'
                                        : 'border-transparent text-gray-600 hover:text-gray-800')
                                }
                            >
                                不動産会社
                            </button>

                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === 'properties'}
                                onClick={() => handleTabChange('properties')}
                                className={
                                    '-mb-px border-b-2 px-4 py-2 focus:outline-none ' +
                                    (tab === 'properties'
                                        ? 'border-indigo-600 bg-white font-medium text-indigo-700'
                                        : 'border-transparent text-gray-600 hover:text-gray-800')
                                }
                            >
                                物件
                            </button>

                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === 'furnitures'}
                                onClick={() => handleTabChange('furnitures')}
                                className={
                                    '-mb-px border-b-2 px-4 py-2 focus:outline-none ' +
                                    (tab === 'furnitures'
                                        ? 'border-indigo-600 bg-white font-medium text-indigo-700'
                                        : 'border-transparent text-gray-600 hover:text-gray-800')
                                }
                            >
                                家具
                            </button>
                        </nav>
                    </div>
                </div>

                {/* create form area (appears between tabs and the list card) */}
                {showCreate && (
                    // when editing a property, we show the property form and a second card for adding furniture to that property
                    <div className="mx-auto mb-4 max-w-6xl">
                        <div className={`grid min-w-0 grid-cols-1 gap-4 break-words ${isPropertyEdit ? 'xl:grid-cols-2' : 'justify-items-center'}`}>
                            <Card className={`${!isPropertyEdit ? 'max-w-4xl' : ''} w-full max-w-3xl min-w-0`}>
                                <CardHeader>
                                    <CardTitle>
                                        {editMode
                                            ? `編集 (${editMode.type === 'agent' ? '不動産会社' : editMode.type === 'property' ? '物件' : '家具'})`
                                            : `新規登録 (${tab === 'agents' ? '不動産会社' : tab === 'properties' ? '物件' : '家具'})`}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {tab === 'agents' && (
                                        <form
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                setErrors({});
                                                try {
                                                    // decide endpoint: create or update (use POST for both per requirement)
                                                    let res;
                                                    if (editMode && editMode.type === 'agent') {
                                                        res = await axios.post(
                                                            safeRoute(
                                                                'properties.masters.real-estate-agents.update.post',
                                                                `/properties/masters/real-estate-agents/${editMode.id}`,
                                                            ),
                                                            {
                                                                name: agentForm.name,
                                                                order_column: agentForm.order_column !== '' ? Number(agentForm.order_column) : 0,
                                                            },
                                                        );
                                                    } else {
                                                        res = await axios.post(
                                                            safeRoute(
                                                                'properties.masters.real-estate-agents.store',
                                                                '/properties/masters/real-estate-agents',
                                                            ),
                                                            {
                                                                name: agentForm.name,
                                                                order_column: agentForm.order_column !== '' ? Number(agentForm.order_column) : 0,
                                                            },
                                                        );
                                                    }
                                                    setToast({ message: res.data.message || '作成しました', type: 'success' });
                                                    setTimeout(() => setToast(null), 3000);
                                                    // optimistic: add to local list
                                                    if (res.data.agent) {
                                                        if (editMode && editMode.type === 'agent') {
                                                            setAgentsList((s) => s.map((it) => (it.id === res.data.agent.id ? res.data.agent : it)));
                                                        } else {
                                                            setAgentsList((s) => [...s, res.data.agent]);
                                                        }
                                                    }
                                                    setShowCreate(false);
                                                    setAgentForm({ name: '', order_column: '' });
                                                    setEditMode(null);
                                                } catch (err) {
                                                    if (isAxiosErrorWithStatus(err, 422)) {
                                                        const data = (err as { response: { data?: unknown } }).response.data;
                                                        if (data && typeof data === 'object' && 'errors' in (data as Record<string, unknown>)) {
                                                            const maybeErrors = (data as Record<string, unknown>)['errors'];
                                                            if (maybeErrors && typeof maybeErrors === 'object') {
                                                                const cast = maybeErrors as Record<string, string[]>;
                                                                setErrors(cast);
                                                            } else {
                                                                setErrors({});
                                                            }
                                                        } else {
                                                            setErrors({});
                                                        }
                                                    } else {
                                                        setToast({ message: '作成に失敗しました', type: 'error' });
                                                        setTimeout(() => setToast(null), 3000);
                                                    }
                                                }
                                            }}
                                            className="grid grid-cols-1 gap-2"
                                        >
                                            <div>
                                                <Label>
                                                    不動産会社名 <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    name="name"
                                                    placeholder="例: ABC不動産"
                                                    value={agentForm.name}
                                                    onChange={(e) => setAgentForm((s) => ({ ...s, name: e.target.value }))}
                                                />
                                                {errors.name && <div className="mt-1 text-sm text-red-600">{errors.name.join('\n')}</div>}
                                            </div>
                                            <div>
                                                <Label>並び順</Label>
                                                <Input
                                                    name="order_column"
                                                    type="number"
                                                    inputMode="numeric"
                                                    step="1"
                                                    min="0"
                                                    placeholder="例: 0"
                                                    value={agentForm.order_column}
                                                    onChange={(e) => setAgentForm((s) => ({ ...s, order_column: e.target.value }))}
                                                />
                                                {errors.order_column && (
                                                    <div className="mt-1 text-sm text-red-600">{errors.order_column.join('\n')}</div>
                                                )}
                                            </div>
                                            <div className="mt-4 flex justify-end gap-2 md:col-span-2">
                                                <Button variant="outline" onClick={() => setShowCreate(false)}>
                                                    キャンセル
                                                </Button>
                                                <Button type="submit">
                                                    <span>登録</span>
                                                </Button>
                                            </div>
                                        </form>
                                    )}

                                    {tab === 'properties' && (
                                        <form
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                setErrors({});
                                                try {
                                                    // determine order_column: prefer form value, else fallback to existing property's value when editing
                                                    const resolvedOrderColumn =
                                                        propertyForm.order_column !== ''
                                                            ? Number(propertyForm.order_column)
                                                            : editMode && editMode.type === 'property'
                                                              ? Number(propertiesList.find((it) => it.id === editMode.id)?.order_column ?? 0)
                                                              : 0;

                                                    const payload = {
                                                        name: propertyForm.name,
                                                        real_estate_agent_id: propertyForm.real_estate_agent_id,
                                                        postcode: propertyForm.postcode,
                                                        address: propertyForm.address,
                                                        parking: propertyForm.parking,
                                                        layout: propertyForm.layout,
                                                        contract_date: propertyForm.contract_date,
                                                        termination_date: propertyForm.termination_date || null,
                                                        room_details: propertyForm.room_details,
                                                        memo: propertyForm.memo,
                                                        key_returned: propertyForm.key_returned,
                                                        order_column: resolvedOrderColumn,
                                                    };

                                                    let res;
                                                    if (editMode && editMode.type === 'property') {
                                                        res = await axios.post(
                                                            safeRoute(
                                                                'properties.masters.properties.update.post',
                                                                `/properties/masters/properties/${editMode.id}`,
                                                            ),
                                                            payload,
                                                        );
                                                    } else {
                                                        res = await axios.post(
                                                            safeRoute('properties.masters.properties.store', '/properties/masters/properties'),
                                                            payload,
                                                        );
                                                    }

                                                    setToast({ message: res.data.message || '作成しました', type: 'success' });
                                                    setTimeout(() => setToast(null), 3000);
                                                    if (res.data.property) {
                                                        if (editMode && editMode.type === 'property') {
                                                            setPropertiesList((s) =>
                                                                s.map((it) => (it.id === res.data.property.id ? res.data.property : it)),
                                                            );
                                                        } else {
                                                            setPropertiesList((s) => [...s, res.data.property]);
                                                        }
                                                    }

                                                    setShowCreate(false);
                                                    setPropertyForm({
                                                        real_estate_agent_id: null,
                                                        name: '',
                                                        postcode: '',
                                                        address: '',
                                                        parking: '0',
                                                        layout: '',
                                                        room_details: '',
                                                        contract_date: new Date().toISOString().slice(0, 10),
                                                        termination_date: '',
                                                        memo: '',
                                                        key_returned: '0',
                                                        order_column: '',
                                                    });
                                                    setEditMode(null);
                                                } catch (err) {
                                                    if (isAxiosErrorWithStatus(err, 422)) {
                                                        const data = (err as { response: { data?: unknown } }).response.data;
                                                        if (data && typeof data === 'object' && 'errors' in (data as Record<string, unknown>)) {
                                                            const maybeErrors = (data as Record<string, unknown>)['errors'];
                                                            if (maybeErrors && typeof maybeErrors === 'object')
                                                                setErrors(maybeErrors as Record<string, string[]>);
                                                            else setErrors({});
                                                        } else {
                                                            setErrors({});
                                                        }
                                                    } else {
                                                        setToast({ message: '作成に失敗しました', type: 'error' });
                                                        setTimeout(() => setToast(null), 3000);
                                                    }
                                                }
                                            }}
                                            className="grid gap-2 md:grid-cols-2"
                                        >
                                            <div className="md:col-span-2" role="group" aria-required={true}>
                                                <Label>
                                                    不動産会社 <span className="text-destructive">*</span>
                                                </Label>
                                                <SingleSelectCombobox
                                                    options={(agentsList || []).map((a: Agent) => ({ label: a.name, value: a.id }))}
                                                    selected={propertyForm.real_estate_agent_id}
                                                    onChange={(v: string | number | null) =>
                                                        setPropertyForm((s) => ({
                                                            ...s,
                                                            real_estate_agent_id: typeof v === 'number' ? v : v ? Number(v) : null,
                                                        }))
                                                    }
                                                    placeholder="不動産会社を検索して選択"
                                                />
                                                {errors.real_estate_agent_id && (
                                                    <div className="mt-1 text-sm text-red-600">{errors.real_estate_agent_id.join('\n')}</div>
                                                )}
                                            </div>

                                            <div>
                                                <Label>
                                                    物件名 <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    name="name"
                                                    placeholder="例: サンハイツ101"
                                                    required
                                                    value={propertyForm.name}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, name: e.target.value }))}
                                                />
                                            </div>

                                            <div>
                                                <Label>郵便番号</Label>
                                                <Input
                                                    name="postcode"
                                                    placeholder="例: 123-4567"
                                                    value={propertyForm.postcode}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, postcode: e.target.value }))}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <Label>
                                                    住所 <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    name="address"
                                                    placeholder="例: 東京都千代田区1-2-3"
                                                    required
                                                    value={propertyForm.address}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, address: e.target.value }))}
                                                />
                                            </div>

                                            <div>
                                                <Label>
                                                    駐車場 <span className="text-destructive">*</span>
                                                </Label>
                                                <div className="flex items-center gap-4">
                                                    <label className="inline-flex items-center gap-2">
                                                        <input
                                                            type="radio"
                                                            name="parking"
                                                            value="1"
                                                            checked={propertyForm.parking === '1'}
                                                            onChange={() => setPropertyForm((s) => ({ ...s, parking: '1' }))}
                                                            required
                                                        />{' '}
                                                        有
                                                    </label>
                                                    <label className="inline-flex items-center gap-2">
                                                        <input
                                                            type="radio"
                                                            name="parking"
                                                            value="0"
                                                            checked={propertyForm.parking === '0'}
                                                            onChange={() => setPropertyForm((s) => ({ ...s, parking: '0' }))}
                                                        />{' '}
                                                        無
                                                    </label>
                                                </div>
                                            </div>

                                            <div>
                                                <Label>間取り</Label>
                                                <Input
                                                    name="layout"
                                                    placeholder="例: 1LDK"
                                                    value={propertyForm.layout}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, layout: e.target.value }))}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <Label>部屋番号</Label>
                                                <Input
                                                    name="room_details"
                                                    placeholder="例: 101"
                                                    value={propertyForm.room_details}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, room_details: e.target.value }))}
                                                />
                                            </div>

                                            <div>
                                                <Label>物件契約日</Label>
                                                <Input
                                                    name="contract_date"
                                                    type="date"
                                                    value={propertyForm.contract_date}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, contract_date: e.target.value }))}
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <Label>物件解約日</Label>
                                                <Input
                                                    name="termination_date"
                                                    type="date"
                                                    placeholder="未設定"
                                                    value={propertyForm.termination_date}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, termination_date: e.target.value }))}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <Label>メモ</Label>
                                                <Textarea
                                                    name="memo"
                                                    rows={3}
                                                    placeholder="メモを入力..."
                                                    value={propertyForm.memo}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, memo: e.target.value }))}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <Label>鍵返却</Label>
                                                <div className="flex items-center gap-4">
                                                    <label className="inline-flex items-center gap-2">
                                                        <input
                                                            type="radio"
                                                            name="key_returned"
                                                            value="1"
                                                            checked={propertyForm.key_returned === '1'}
                                                            onChange={() => setPropertyForm((s) => ({ ...s, key_returned: '1' }))}
                                                        />{' '}
                                                        有
                                                    </label>
                                                    <label className="inline-flex items-center gap-2">
                                                        <input
                                                            type="radio"
                                                            name="key_returned"
                                                            value="0"
                                                            checked={propertyForm.key_returned === '0'}
                                                            onChange={() => setPropertyForm((s) => ({ ...s, key_returned: '0' }))}
                                                        />{' '}
                                                        無
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2">
                                                <Label>並び順</Label>
                                                <Input
                                                    name="order_column"
                                                    type="number"
                                                    inputMode="numeric"
                                                    step="1"
                                                    min="0"
                                                    placeholder="例: 0"
                                                    value={propertyForm.order_column}
                                                    onChange={(e) => setPropertyForm((s) => ({ ...s, order_column: e.target.value }))}
                                                />
                                                {errors.order_column && (
                                                    <div className="mt-1 text-sm text-red-600">{errors.order_column.join('\n')}</div>
                                                )}
                                            </div>

                                            <div className="flex justify-end gap-2 md:col-span-2">
                                                <Button type="submit">登録</Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setShowCreate(false);
                                                        setEditMode(null);
                                                    }}
                                                >
                                                    キャンセル
                                                </Button>
                                            </div>
                                        </form>
                                    )}

                                    {tab === 'furnitures' && (
                                        <form
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                setErrors({});
                                                try {
                                                    let res;
                                                    const payload = {
                                                        name: furnitureForm.name,
                                                        order_column: furnitureForm.order_column !== '' ? Number(furnitureForm.order_column) : 0,
                                                    };
                                                    if (editMode && editMode.type === 'furniture') {
                                                        res = await axios.post(
                                                            safeRoute(
                                                                'properties.masters.furniture-masters.update.post',
                                                                `/properties/masters/furniture-masters/${editMode.id}`,
                                                            ),
                                                            payload,
                                                        );
                                                    } else {
                                                        res = await axios.post(
                                                            safeRoute(
                                                                'properties.masters.furniture-masters.store',
                                                                '/properties/masters/furniture-masters',
                                                            ),
                                                            payload,
                                                        );
                                                    }
                                                    setToast({ message: res.data.message || '作成しました', type: 'success' });
                                                    setTimeout(() => setToast(null), 3000);
                                                    if (res.data.furniture) {
                                                        if (editMode && editMode.type === 'furniture') {
                                                            setFurnituresList((s) =>
                                                                s.map((it) => (it.id === res.data.furniture.id ? res.data.furniture : it)),
                                                            );
                                                        } else {
                                                            setFurnituresList((s) => [...s, res.data.furniture]);
                                                        }
                                                    }
                                                    setShowCreate(false);
                                                    setFurnitureForm({ name: '', order_column: '' });
                                                    setEditMode(null);
                                                } catch (err) {
                                                    if (isAxiosErrorWithStatus(err, 422)) {
                                                        const data = (err as { response: { data?: unknown } }).response.data;
                                                        if (data && typeof data === 'object' && 'errors' in (data as Record<string, unknown>)) {
                                                            const maybeErrors = (data as Record<string, unknown>)['errors'];
                                                            if (maybeErrors && typeof maybeErrors === 'object')
                                                                setErrors(maybeErrors as Record<string, string[]>);
                                                            else setErrors({});
                                                        } else {
                                                            setErrors({});
                                                        }
                                                    } else {
                                                        setToast({ message: '作成に失敗しました', type: 'error' });
                                                        setTimeout(() => setToast(null), 3000);
                                                    }
                                                }
                                            }}
                                            className="grid grid-cols-1 gap-2"
                                        >
                                            <div>
                                                <Label>
                                                    家具名 <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    name="name"
                                                    placeholder="例: テーブル"
                                                    value={furnitureForm.name}
                                                    onChange={(e) => setFurnitureForm((s) => ({ ...s, name: e.target.value }))}
                                                />
                                                {errors.name && <div className="mt-1 text-sm text-red-600">{errors.name.join('\n')}</div>}
                                            </div>
                                            <div>
                                                <Label>並び順</Label>
                                                <Input
                                                    name="order_column"
                                                    type="number"
                                                    inputMode="numeric"
                                                    step="1"
                                                    min="0"
                                                    placeholder="例: 0"
                                                    value={furnitureForm.order_column}
                                                    onChange={(e) => setFurnitureForm((s) => ({ ...s, order_column: e.target.value }))}
                                                />
                                                {errors.order_column && (
                                                    <div className="mt-1 text-sm text-red-600">{errors.order_column.join('\n')}</div>
                                                )}
                                            </div>
                                            <div className="mt-4 flex justify-end gap-2 md:col-span-2">
                                                <Button variant="outline" onClick={() => setShowCreate(false)}>
                                                    キャンセル
                                                </Button>
                                                <Button type="submit">登録</Button>
                                            </div>
                                        </form>
                                    )}
                                </CardContent>
                            </Card>

                            {/* when editing a property, show furniture add card */}
                            {editMode && editMode.type === 'property' && (
                                <Card className="w-full min-w-0">
                                    <CardHeader>
                                        <CardTitle>物件の家具を登録</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <form
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                setErrors({});
                                                try {
                                                    const payload = {
                                                        property_id: editMode?.type === 'property' ? editMode.id : propertyFurnitureForm.property_id,
                                                        furniture_master_id: propertyFurnitureForm.furniture_master_id,
                                                        quantity: Number(propertyFurnitureForm.quantity ?? 0),
                                                        removal_start_date: propertyFurnitureForm.removal_start_date || null,
                                                        removal_date: propertyFurnitureForm.removal_date || null,
                                                    };
                                                    // decide create vs update based on form.id
                                                    let res: AxiosResponse<{
                                                        property_furniture: import('@/types').PropertyFurniture;
                                                        message?: string;
                                                    }>;
                                                    if (propertyFurnitureForm.id) {
                                                        // update existing
                                                        res = await axios.post(
                                                            safeRoute(
                                                                'properties.masters.property-furniture.update.post',
                                                                `/properties/masters/property-furniture/${propertyFurnitureForm.id}`,
                                                            ),
                                                            payload,
                                                        );
                                                        setToast({ message: res.data.message || '物件の家具を更新しました', type: 'success' });
                                                        // update local details state
                                                        const pidKey = Number(payload.property_id);
                                                        if (Number.isFinite(pidKey)) {
                                                            setPropertyFurnituresDetailsState(
                                                                (s: Record<number, import('@/types').PropertyFurniture[]>) => {
                                                                    const list = (s[pidKey] || []).map((r: import('@/types').PropertyFurniture) =>
                                                                        r.id === res.data.property_furniture.id ? res.data.property_furniture : r,
                                                                    );
                                                                    return { ...s, [pidKey]: list };
                                                                },
                                                            );
                                                        }
                                                    } else {
                                                        // create new
                                                        res = await axios.post(
                                                            safeRoute(
                                                                'properties.masters.property-furniture.store',
                                                                '/properties/masters/property-furniture',
                                                            ),
                                                            payload,
                                                        );
                                                        setToast({ message: res.data.message || '家具を登録しました', type: 'success' });
                                                        // append to local details and map
                                                        const pf: import('@/types').PropertyFurniture = res.data.property_furniture;
                                                        const pidKey = Number(pf.property_id);
                                                        if (Number.isFinite(pidKey)) {
                                                            setPropertyFurnituresDetailsState((s) => ({
                                                                ...(s || {}),
                                                                [pidKey]: [...(s[pidKey] || []), pf],
                                                            }));
                                                            setPropertyFurnituresMapState((s) => ({
                                                                ...(s || {}),
                                                                [pidKey]: [...(s[pidKey] || []), pf.furniture_master_id],
                                                            }));
                                                        }
                                                    }
                                                    setTimeout(() => setToast(null), 3000);
                                                    // reset form
                                                    setPropertyFurnitureForm({
                                                        id: null,
                                                        property_id: null,
                                                        furniture_master_id: null,
                                                        quantity: 0,
                                                        removal_start_date: '',
                                                        removal_date: '',
                                                    });
                                                } catch (err) {
                                                    if (isAxiosErrorWithStatus(err, 422)) {
                                                        const data = (err as { response: { data?: unknown } }).response.data;
                                                        if (data && typeof data === 'object' && 'errors' in (data as Record<string, unknown>)) {
                                                            const maybeErrors = (data as Record<string, unknown>)['errors'];
                                                            if (maybeErrors && typeof maybeErrors === 'object')
                                                                setErrors(maybeErrors as Record<string, string[]>);
                                                            else setErrors({});
                                                        } else setErrors({});
                                                    } else {
                                                        setToast({ message: '家具の登録に失敗しました', type: 'error' });
                                                        setTimeout(() => setToast(null), 3000);
                                                    }
                                                }
                                            }}
                                            className="grid gap-2"
                                        >
                                            <div>
                                                <Label>
                                                    物件名 <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    value={
                                                        propertiesList.find((it) => it.id === (editMode?.id ?? propertyFurnitureForm.property_id))
                                                            ?.name || ''
                                                    }
                                                    readOnly
                                                    className="cursor-not-allowed bg-gray-100 text-muted-foreground"
                                                />
                                            </div>

                                            <div>
                                                <Label>
                                                    家具 <span className="text-destructive">*</span>
                                                </Label>
                                                {/* show all furniture but mark already-registered ones as disabled (greyed out) */}
                                                <SingleSelectCombobox
                                                    options={(furnituresList || []).map((f: Furniture) => {
                                                        const pid = Number(editMode?.id ?? propertyFurnitureForm.property_id ?? -1);
                                                        const existing = propertyFurnituresMapState[pid] || [];
                                                        return { label: f.name, value: f.id, disabled: existing.includes(f.id) };
                                                    })}
                                                    selected={propertyFurnitureForm.furniture_master_id}
                                                    onChange={(v: string | number | null) =>
                                                        setPropertyFurnitureForm((s) => ({
                                                            ...s,
                                                            furniture_master_id: typeof v === 'number' ? v : v ? Number(v) : null,
                                                        }))
                                                    }
                                                    placeholder="家具を検索して選択"
                                                />
                                                {errors.furniture_master_id && (
                                                    <div className="mt-1 text-sm text-red-600">{errors.furniture_master_id.join('\n')}</div>
                                                )}
                                            </div>

                                            <div>
                                                <Label>
                                                    個数 <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={0}
                                                    value={String(propertyFurnitureForm.quantity)}
                                                    onChange={(e) => setPropertyFurnitureForm((s) => ({ ...s, quantity: e.target.value }))}
                                                />
                                                {errors.quantity && <div className="mt-1 text-sm text-red-600">{errors.quantity.join('\n')}</div>}
                                            </div>

                                            <div>
                                                <Label>搬出開始日</Label>
                                                <Input
                                                    type="date"
                                                    value={propertyFurnitureForm.removal_start_date}
                                                    onChange={(e) => setPropertyFurnitureForm((s) => ({ ...s, removal_start_date: e.target.value }))}
                                                />
                                                {errors.removal_start_date && (
                                                    <div className="mt-1 text-sm text-red-600">{errors.removal_start_date.join('\n')}</div>
                                                )}
                                            </div>

                                            <div>
                                                <Label>搬出日</Label>
                                                <Input
                                                    type="date"
                                                    value={propertyFurnitureForm.removal_date}
                                                    onChange={(e) => setPropertyFurnitureForm((s) => ({ ...s, removal_date: e.target.value }))}
                                                />
                                                {errors.removal_date && (
                                                    <div className="mt-1 text-sm text-red-600">{errors.removal_date.join('\n')}</div>
                                                )}
                                            </div>

                                            <div className="mt-4 flex justify-end gap-2 md:col-span-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        setPropertyFurnitureForm({
                                                            property_id: null,
                                                            furniture_master_id: null,
                                                            quantity: 0,
                                                            removal_start_date: '',
                                                            removal_date: '',
                                                        })
                                                    }
                                                >
                                                    リセット
                                                </Button>
                                                <Button type="submit">登録</Button>
                                            </div>
                                        </form>
                                        {/* registered furniture list for this property */}
                                        <div className="mt-4 w-full min-w-0">
                                            <h4 className="mb-2 text-sm font-medium">登録済みの家具</h4>
                                            <div
                                                className={
                                                    'space-y-2 ' + (registeredFurnitureList.length >= 8 ? 'max-h-64 overflow-y-auto pr-2' : '')
                                                }
                                                style={{ boxSizing: 'border-box' }}
                                            >
                                                {registeredFurnitureList.map((row: import('@/types').PropertyFurniture) => {
                                                    const master = furnituresList.find((f) => f.id === row.furniture_master_id);
                                                    const formatYmd = (v?: string) =>
                                                        v ? new Date(v).toISOString().slice(0, 10).replace(/-/g, '/') : null;
                                                    const parts: string[] = [];
                                                    parts.push(`${master ? master.name : '—'}：${row.quantity}`);
                                                    const start = formatYmd(row.removal_start_date as string | undefined);
                                                    if (start) parts.push(`搬出開始日 ${start}`);
                                                    if (row.removal_date) {
                                                        const end =
                                                            formatYmd(row.removal_date as string | undefined) ||
                                                            new Date(row.removal_date).toLocaleDateString();
                                                        parts.push(`搬出日 ${end}`);
                                                    }
                                                    const label = parts.join(' ／ ');
                                                    return (
                                                        <div
                                                            key={row.id}
                                                            className="flex w-full min-w-0 items-center justify-between rounded-md border px-3 py-2 hover:bg-gray-50"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    // load into form for editing (include id so save updates)
                                                                    setPropertyFurnitureForm({
                                                                        id: row.id,
                                                                        property_id:
                                                                            editMode?.type === 'property'
                                                                                ? editMode.id
                                                                                : propertyFurnitureForm.property_id,
                                                                        furniture_master_id: row.furniture_master_id,
                                                                        quantity: row.quantity ?? 0,
                                                                        removal_start_date: row.removal_start_date ?? '',
                                                                        removal_date: row.removal_date ?? '',
                                                                    });
                                                                }}
                                                                className="w-full min-w-0 flex-1 pr-4 text-left"
                                                            >
                                                                <div className="truncate text-sm break-words" style={{ wordBreak: 'break-word' }}>
                                                                    {label}
                                                                </div>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!confirm('この登録を削除しますか？')) return;
                                                                    try {
                                                                        await axios.delete(
                                                                            safeRoute(
                                                                                'properties.masters.property-furniture.destroy',
                                                                                `/properties/masters/property-furniture/${row.id}`,
                                                                            ),
                                                                        );
                                                                        // remove from details and map
                                                                        const pidKey = Number(
                                                                            editMode?.id ?? propertyFurnitureForm.property_id ?? -1,
                                                                        );
                                                                        setPropertyFurnituresDetailsState((s) => ({
                                                                            ...(s || {}),
                                                                            [pidKey]: (s[pidKey] || []).filter((r) => r.id !== row.id),
                                                                        }));
                                                                        setPropertyFurnituresMapState((s) => ({
                                                                            ...(s || {}),
                                                                            [pidKey]: (s[pidKey] || []).filter(
                                                                                (fid) => fid !== row.furniture_master_id,
                                                                            ),
                                                                        }));
                                                                        setToast({ message: '登録を削除しました', type: 'success' });
                                                                        setTimeout(() => setToast(null), 3000);
                                                                        // if the form was showing this row, reset it
                                                                        if (propertyFurnitureForm.id === row.id) {
                                                                            setPropertyFurnitureForm({
                                                                                id: null,
                                                                                property_id: null,
                                                                                furniture_master_id: null,
                                                                                quantity: 0,
                                                                                removal_start_date: '',
                                                                                removal_date: '',
                                                                            });
                                                                        }
                                                                    } catch (err) {
                                                                        if (isAxiosErrorWithStatus(err, 409)) {
                                                                            const data = (err as { response: { data?: unknown } }).response.data;
                                                                            const msg =
                                                                                data &&
                                                                                typeof data === 'object' &&
                                                                                'message' in (data as Record<string, unknown>)
                                                                                    ? (data as Record<string, unknown>).message
                                                                                    : undefined;
                                                                            setToast({
                                                                                message: (msg as string) || '参照制約により削除できません',
                                                                                type: 'error',
                                                                            });
                                                                        } else {
                                                                            setToast({ message: '削除に失敗しました', type: 'error' });
                                                                        }
                                                                        setTimeout(() => setToast(null), 3000);
                                                                    }
                                                                }}
                                                                className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded bg-transparent text-red-600 hover:bg-red-50"
                                                                style={{ flex: '0 0 auto' }}
                                                                aria-label="削除"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>一覧</CardTitle>
                        <div>
                            <Button
                                onClick={() => {
                                    // only allow toggling create panel for properties when allowed
                                    if (tab === 'properties' && !canProperties.create) return;
                                    setShowCreate((s) => {
                                        const next = !s;
                                        if (next) {
                                            // opening create panel: clear any edit mode and reset forms
                                            setEditMode(null);
                                            setAgentForm({ name: '', order_column: '' });
                                            setFurnitureForm({ name: '', order_column: '' });
                                            setPropertyForm({
                                                real_estate_agent_id: null,
                                                name: '',
                                                postcode: '',
                                                address: '',
                                                parking: '0',
                                                layout: '',
                                                room_details: '',
                                                contract_date: new Date().toISOString().slice(0, 10),
                                                termination_date: '',
                                                memo: '',
                                                key_returned: '0',
                                                order_column: '',
                                            });
                                            setPropertyFurnitureForm({
                                                id: null,
                                                property_id: null,
                                                furniture_master_id: null,
                                                quantity: 0,
                                                removal_start_date: '',
                                                removal_date: '',
                                            });
                                            setErrors({});
                                        }
                                        return next;
                                    });
                                }}
                                aria-pressed={showCreate}
                                aria-label={showCreate ? '新規作成を閉じる' : '新規作成'}
                                disabled={tab === 'properties' && !canProperties.create}
                            >
                                <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">{showCreate ? '閉じる' : '新規作成'}</span>
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {/* Agents tab content */}
                        {tab === 'agents' && (
                            <div>
                                <div className="space-y-3 md:hidden">
                                    {(agentsList || []).map((a: Agent) => (
                                        <div key={a.id} className={`rounded-md border p-4 hover:bg-gray-50`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium text-foreground">{a.name}</div>
                                                    <div className="mt-1 truncate text-xs text-muted-foreground">並び順: {a.order_column}</div>
                                                </div>
                                                <div className="flex flex-col items-end space-y-2">
                                                    <div className="text-xs text-muted-foreground">ID: {a.id}</div>
                                                    <Link
                                                        href=""
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                        }}
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="p-2"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setEditMode({ type: 'agent', id: a.id });
                                                                setShowCreate(true);
                                                                setAgentForm({ name: a.name, order_column: a.order_column?.toString() || '' });
                                                            }}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    <SortableHeader sort_key="order_column" queryParams={qp} listName="agents">
                                                        並び順
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>
                                                    <SortableHeader sort_key="name" queryParams={qp} listName="agents">
                                                        不動産会社名
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(agentsList || []).map((a: Agent) => (
                                                <TableRow
                                                    key={a.id}
                                                    className="hover:bg-gray-50"
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, a.id)}
                                                    onDragOver={onDragOver}
                                                    onDrop={(e) => reorderOnDrop(e, a.id, 'agents')}
                                                >
                                                    <TableCell>
                                                        <button
                                                            aria-label="ドラッグして並び替え"
                                                            className="mr-2 inline-block text-gray-400 hover:text-gray-600 md:inline"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <GripVertical className="h-4 w-4" />
                                                        </button>
                                                        {a.order_column}
                                                    </TableCell>
                                                    <TableCell>{a.name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="inline-flex justify-end gap-2">
                                                            <Link
                                                                href=""
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                }}
                                                            >
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setEditMode({ type: 'agent', id: a.id });
                                                                        setShowCreate(true);
                                                                        setAgentForm({
                                                                            name: a.name,
                                                                            order_column: a.order_column?.toString() || '',
                                                                        });
                                                                    }}
                                                                >
                                                                    <Edit className="mr-2 h-4 w-4" /> 編集
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!confirm('この不動産会社を削除しますか？')) return;
                                                                    try {
                                                                        const res = await axios.delete(
                                                                            safeRoute(
                                                                                'properties.masters.real-estate-agents.destroy',
                                                                                `/properties/masters/real-estate-agents/${a.id}`,
                                                                            ),
                                                                        );
                                                                        setToast({ message: res.data.message || '削除しました', type: 'success' });
                                                                        setTimeout(() => setToast(null), 3000);
                                                                        setAgentsList((s) => s.filter((it) => it.id !== a.id));
                                                                    } catch (err) {
                                                                        if (isAxiosErrorWithStatus(err, 409)) {
                                                                            const data = (err as { response: { data?: unknown } }).response.data;
                                                                            const msg =
                                                                                data &&
                                                                                typeof data === 'object' &&
                                                                                'message' in (data as Record<string, unknown>)
                                                                                    ? (data as Record<string, unknown>).message
                                                                                    : undefined;
                                                                            setToast({
                                                                                message:
                                                                                    (msg as string) || '他のデータで参照されているため削除できません',
                                                                                type: 'error',
                                                                            });
                                                                        } else {
                                                                            setToast({ message: '削除に失敗しました', type: 'error' });
                                                                        }
                                                                        setTimeout(() => setToast(null), 3000);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash className="mr-2 h-4 w-4" /> 削除
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Properties tab content */}
                        {tab === 'properties' && (
                            <div>
                                <div className="space-y-3 md:hidden">
                                    {(propertiesList || []).map((p: Property) => (
                                        <div key={p.id}>
                                            <div onClick={() => togglePropertyOpen(p.id)} className="cursor-pointer">
                                                <PropertyListItem
                                                    p={p}
                                                    agents={agentsList}
                                                    onDelete={async () => {
                                                        if (!confirm('この物件を削除しますか？')) return;
                                                        try {
                                                            const res = await axios.delete(
                                                                safeRoute(
                                                                    'properties.masters.properties.destroy',
                                                                    `/properties/masters/properties/${p.id}`,
                                                                ),
                                                            );
                                                            setToast({ message: res.data.message || '削除しました', type: 'success' });
                                                            setTimeout(() => setToast(null), 3000);
                                                            setPropertiesList((s) => s.filter((it) => it.id !== p.id));
                                                        } catch (err) {
                                                            if (isAxiosErrorWithStatus(err, 409)) {
                                                                const data = (err as { response: { data?: unknown } }).response.data;
                                                                const msg =
                                                                    data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)
                                                                        ? (data as Record<string, unknown>).message
                                                                        : undefined;
                                                                setToast({
                                                                    message: (msg as string) || '他のデータで参照されているため削除できません',
                                                                    type: 'error',
                                                                });
                                                            } else {
                                                                setToast({ message: '削除に失敗しました', type: 'error' });
                                                            }
                                                            setTimeout(() => setToast(null), 3000);
                                                        }
                                                    }}
                                                    onEdit={() => {
                                                        setEditMode({ type: 'property', id: p.id });
                                                        setShowCreate(true);
                                                        setPropertyForm({
                                                            real_estate_agent_id: p.real_estate_agent_id ?? null,
                                                            name: p.name || '',
                                                            postcode: p.postcode || '',
                                                            address: p.address || '',
                                                            parking: p.parking !== undefined && p.parking !== null ? String(p.parking) : '0',
                                                            layout: p.layout || '',
                                                            room_details: p.room_details || '',
                                                            contract_date: p.contract_date || new Date().toISOString().slice(0, 10),
                                                            termination_date: p.termination_date || '',
                                                            memo: p.memo || '',
                                                            key_returned:
                                                                p.key_returned !== undefined && p.key_returned !== null
                                                                    ? String(p.key_returned)
                                                                    : '0',
                                                            order_column:
                                                                p.order_column !== undefined && p.order_column !== null ? String(p.order_column) : '',
                                                        });
                                                    }}
                                                />
                                            </div>
                                            {openPropertyId === p.id && <div className="mt-2 px-4">{renderPropertyFurnitureList(p.id)}</div>}
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    <SortableHeader sort_key="order_column" queryParams={qp} listName="properties">
                                                        並び順
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>
                                                    <SortableHeader sort_key="agent_name" queryParams={qp} listName="properties">
                                                        不動産会社
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>
                                                    <SortableHeader sort_key="name" queryParams={qp} listName="properties">
                                                        物件名
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>
                                                    <SortableHeader sort_key="parking" queryParams={qp} listName="properties">
                                                        駐車場
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>
                                                    <SortableHeader sort_key="contract_date" queryParams={qp} listName="properties">
                                                        契約日
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>
                                                    <SortableHeader sort_key="termination_date" queryParams={qp} listName="properties">
                                                        解約日
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>鍵返却</TableHead>
                                                <TableHead>メモ</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(propertiesList || []).map((p: Property) => (
                                                <React.Fragment key={p.id}>
                                                    <PropertyTableRow
                                                        p={p}
                                                        agents={agentsList}
                                                        onClick={() => togglePropertyOpen(p.id)}
                                                        onRowDragStart={(e: React.DragEvent) => onDragStart(e, p.id)}
                                                        onRowDragOver={onDragOver}
                                                        onRowDrop={(e: React.DragEvent) => reorderOnDrop(e, p.id, 'properties')}
                                                        onDelete={async () => {
                                                            if (!confirm('この物件を削除しますか？')) return;
                                                            try {
                                                                const res = await axios.delete(
                                                                    safeRoute(
                                                                        'properties.masters.properties.destroy',
                                                                        `/properties/masters/properties/${p.id}`,
                                                                    ),
                                                                );
                                                                setToast({ message: res.data.message || '削除しました', type: 'success' });
                                                                setTimeout(() => setToast(null), 3000);
                                                                setPropertiesList((s) => s.filter((it) => it.id !== p.id));
                                                            } catch (err) {
                                                                if (isAxiosErrorWithStatus(err, 409)) {
                                                                    const data = (err as { response: { data?: unknown } }).response.data;
                                                                    const msg =
                                                                        data &&
                                                                        typeof data === 'object' &&
                                                                        'message' in (data as Record<string, unknown>)
                                                                            ? (data as Record<string, unknown>).message
                                                                            : undefined;
                                                                    setToast({
                                                                        message: (msg as string) || '他のデータで参照されているため削除できません',
                                                                        type: 'error',
                                                                    });
                                                                } else {
                                                                    setToast({ message: '削除に失敗しました', type: 'error' });
                                                                }
                                                                setTimeout(() => setToast(null), 3000);
                                                            }
                                                        }}
                                                        onEdit={() => {
                                                            setEditMode({ type: 'property', id: p.id });
                                                            setShowCreate(true);
                                                            setPropertyForm({
                                                                real_estate_agent_id: p.real_estate_agent_id ?? null,
                                                                name: p.name || '',
                                                                postcode: p.postcode || '',
                                                                address: p.address || '',
                                                                parking: p.parking !== undefined && p.parking !== null ? String(p.parking) : '0',
                                                                layout: p.layout || '',
                                                                room_details: p.room_details || '',
                                                                contract_date: p.contract_date || new Date().toISOString().slice(0, 10),
                                                                termination_date: p.termination_date || '',
                                                                memo: p.memo || '',
                                                                key_returned:
                                                                    p.key_returned !== undefined && p.key_returned !== null
                                                                        ? String(p.key_returned)
                                                                        : '0',
                                                                order_column:
                                                                    p.order_column !== undefined && p.order_column !== null
                                                                        ? String(p.order_column)
                                                                        : '',
                                                            });
                                                        }}
                                                    />
                                                    {openPropertyId === p.id && (
                                                        <TableRow>
                                                            <TableCell colSpan={9}>
                                                                <div className="mt-2">{renderPropertyFurnitureList(p.id)}</div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Furnitures tab content */}
                        {tab === 'furnitures' && (
                            <div>
                                <div className="space-y-3 md:hidden">
                                    {(furnituresList || []).map((f: Furniture) => (
                                        <div key={f.id} className={`rounded-md border p-4 hover:bg-gray-50`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium text-foreground">{f.name}</div>
                                                    <div className="mt-1 truncate text-xs text-muted-foreground">並び順: {f.order_column}</div>
                                                </div>
                                                <div className="flex flex-col items-end space-y-2">
                                                    <div className="text-xs text-muted-foreground">ID: {f.id}</div>
                                                    <Link
                                                        href=""
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                        }}
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="p-2"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setEditMode({ type: 'furniture', id: f.id });
                                                                setShowCreate(true);
                                                                setFurnitureForm({ name: f.name, order_column: f.order_column?.toString() || '' });
                                                            }}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!confirm('この家具を削除しますか？')) return;
                                                            try {
                                                                const res = await axios.delete(
                                                                    safeRoute(
                                                                        'properties.masters.furniture-masters.destroy',
                                                                        `/properties/masters/furniture-masters/${f.id}`,
                                                                    ),
                                                                );
                                                                setToast({ message: res.data.message || '削除しました', type: 'success' });
                                                                setTimeout(() => setToast(null), 3000);
                                                                setFurnituresList((s) => s.filter((it) => it.id !== f.id));
                                                            } catch (err) {
                                                                if (isAxiosErrorWithStatus(err, 409)) {
                                                                    const data = (err as { response: { data?: unknown } }).response.data;
                                                                    const msg =
                                                                        data &&
                                                                        typeof data === 'object' &&
                                                                        'message' in (data as Record<string, unknown>)
                                                                            ? (data as Record<string, unknown>).message
                                                                            : undefined;
                                                                    setToast({
                                                                        message: (msg as string) || '他のデータで参照されているため削除できません',
                                                                        type: 'error',
                                                                    });
                                                                } else {
                                                                    setToast({ message: '削除に失敗しました', type: 'error' });
                                                                }
                                                                setTimeout(() => setToast(null), 3000);
                                                            }
                                                        }}
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    <SortableHeader sort_key="order_column" queryParams={qp} listName="furnitures">
                                                        並び順
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead>
                                                    <SortableHeader sort_key="name" queryParams={qp} listName="furnitures">
                                                        家具名
                                                    </SortableHeader>
                                                </TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(furnituresList || []).map((f: Furniture) => (
                                                <TableRow
                                                    key={f.id}
                                                    className="hover:bg-gray-50"
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, f.id)}
                                                    onDragOver={onDragOver}
                                                    onDrop={(e) => reorderOnDrop(e, f.id, 'furnitures')}
                                                >
                                                    <TableCell>
                                                        <button
                                                            aria-label="ドラッグして並び替え"
                                                            className="mr-2 inline-block text-gray-400 hover:text-gray-600 md:inline"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <GripVertical className="h-4 w-4" />
                                                        </button>
                                                        {f.order_column}
                                                    </TableCell>
                                                    <TableCell>{f.name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="inline-flex justify-end gap-2">
                                                            <Link
                                                                href=""
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                }}
                                                            >
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setEditMode({ type: 'furniture', id: f.id });
                                                                        setShowCreate(true);
                                                                        setFurnitureForm({
                                                                            name: f.name,
                                                                            order_column: f.order_column?.toString() || '',
                                                                        });
                                                                    }}
                                                                >
                                                                    <Edit className="mr-2 h-4 w-4" /> 編集
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!confirm('この家具を削除しますか？')) return;
                                                                    try {
                                                                        const res = await axios.delete(
                                                                            safeRoute(
                                                                                'properties.masters.furniture-masters.destroy',
                                                                                `/properties/masters/furniture-masters/${f.id}`,
                                                                            ),
                                                                        );
                                                                        setToast({ message: res.data.message || '削除しました', type: 'success' });
                                                                        setTimeout(() => setToast(null), 3000);
                                                                        setFurnituresList((s) => s.filter((it) => it.id !== f.id));
                                                                    } catch (err) {
                                                                        if (isAxiosErrorWithStatus(err, 409)) {
                                                                            const data = (err as { response: { data?: unknown } }).response.data;
                                                                            const msg =
                                                                                data &&
                                                                                typeof data === 'object' &&
                                                                                'message' in (data as Record<string, unknown>)
                                                                                    ? (data as Record<string, unknown>).message
                                                                                    : undefined;
                                                                            setToast({
                                                                                message:
                                                                                    (msg as string) || '他のデータで参照されているため削除できません',
                                                                                type: 'error',
                                                                            });
                                                                        } else {
                                                                            setToast({ message: '削除に失敗しました', type: 'error' });
                                                                        }
                                                                        setTimeout(() => setToast(null), 3000);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash className="mr-2 h-4 w-4" /> 削除
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppSidebarLayout>
    );
}

// --- 小さなサブコンポーネント ---
function PropertyListItem({ p, agents, onDelete, onEdit }: { p: Property; agents: Agent[]; onDelete?: () => void; onEdit?: () => void }) {
    const agentName = (agents || []).find((a: Agent) => a.id === p.real_estate_agent_id)?.name || '—';

    return (
        <div className="rounded-md border">
            <div className={`p-4 hover:bg-gray-50`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                            {p.name}
                            {p.room_details ? `（${p.room_details}）` : ''} {p.layout ? `[${p.layout}]` : ''}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            {p.postcode ? `〒${p.postcode} ${p.address || '—'}` : p.address || '—'}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{agentName}</div>
                        <div className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">メモ: {p.memo || '—'}</div>
                        <div className="mt-1 text-sm text-muted-foreground">鍵返却: {p.key_returned ? 'あり' : 'なし'}</div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                        <div className="text-xs text-muted-foreground">ID: {p.id}</div>
                        <a
                            href=""
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="p-2"
                                aria-label="編集"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEdit?.();
                                }}
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        </a>
                        {onDelete && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="ml-2"
                            >
                                <Trash className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PropertyTableRow({
    p,
    agents,
    onDelete,
    onEdit,
    onRowDragStart,
    onRowDragOver,
    onRowDrop,
    onClick,
}: {
    p: Property;
    agents: Agent[];
    onDelete?: () => void;
    onEdit?: () => void;
    onRowDragStart?: (e: React.DragEvent) => void;
    onRowDragOver?: (e: React.DragEvent) => void;
    onRowDrop?: (e: React.DragEvent) => void | Promise<void>;
    onClick?: () => void;
}) {
    const agentName = (agents || []).find((a: Agent) => a.id === p.real_estate_agent_id)?.name || '—';

    return (
        <TableRow
            className="hover:bg-gray-50"
            draggable={!!onRowDragStart}
            onDragStart={onRowDragStart}
            onDragOver={onRowDragOver}
            onDrop={onRowDrop}
            onClick={onClick}
        >
            <TableCell>
                <button
                    aria-label="ドラッグして並び替え"
                    className="mr-2 inline-block text-gray-400 hover:text-gray-600 md:inline"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                {p.order_column}
            </TableCell>
            <TableCell>{agentName}</TableCell>
            <TableCell>
                <div className="min-w-0">
                    <div className="truncate">
                        {p.name}
                        {p.room_details ? `（${p.room_details}）` : ''} {p.layout ? `[${p.layout}]` : ''}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{p.postcode ? `〒${p.postcode} ${p.address || '—'}` : p.address || '—'}</div>
                </div>
            </TableCell>
            <TableCell>{p.parking ? '有' : '無'}</TableCell>
            <TableCell>{p.contract_date ? new Date(p.contract_date).toLocaleDateString() : '—'}</TableCell>
            <TableCell>{p.termination_date ? new Date(p.termination_date).toLocaleDateString() : '—'}</TableCell>
            <TableCell>{p.key_returned ? 'あり' : 'なし'}</TableCell>
            <TableCell className="max-w-[18rem] whitespace-pre-wrap">{p.memo || '—'}</TableCell>
            <TableCell className="text-right">
                <div className="inline-flex justify-end gap-2">
                    <Button
                        variant="outline"
                        className="text-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.();
                        }}
                    >
                        <Edit className="mr-1" /> 編集
                    </Button>
                    {onDelete ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                        >
                            <Trash className="mr-2 h-4 w-4" /> 削除
                        </Button>
                    ) : (
                        <Button variant="destructive" size="sm" onClick={(e) => e.stopPropagation()}>
                            <Trash className="mr-2 h-4 w-4" /> 削除
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}
