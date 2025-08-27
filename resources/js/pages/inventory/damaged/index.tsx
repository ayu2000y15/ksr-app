import { BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Edit, Plus } from 'lucide-react';
import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import Heading from '@/components/heading';
import ImageModal from '@/components/posts/image-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox';
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';

type InventoryItemOption = { id: number; name: string; category?: { id: number; name: string } | null };
type UserOption = { id: number; name: string };
type DamageConditionOption = { id: number; condition: string };

type Att = { file_path?: string; original_name?: string };
type AttFull = { id: number; file_path: string; original_name?: string };
type DamagedItem = {
    id: number;
    damaged_at?: string;
    inventory_item?: { id?: number; name?: string; category?: { id?: number; name?: string } } | null;
    inventory_item_id?: number;
    management_number?: string;
    handler_user?: { id?: number; name?: string } | null;
    handler_user_id?: number;
    receipt_image_path?: string | null;
    attachments?: Att[];
    damage_condition?: { condition?: string } | null;
    damaged_area?: string;
    memo?: string;
    compensation_amount?: number | string | null;
    payment_method?: string;
    receipt_number?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_id_image_path?: string | null;
    damage_condition_id?: number | null;
};

type FormState = {
    inventory_item_id: number | '';
    handler_user_id: number | '';
    management_number: string;
    damaged_at: string;
    damage_condition_id: number | '';
    damaged_area: string;
    customer_name: string;
    customer_phone: string;
    compensation_amount: string;
    payment_method: string;
    receipt_number: string;
    receipt_image: File | null;
    customer_id_image: File | null;
    memo: string;
};

type StatsType = {
    [month: string]: {
        total: number;
        categories: {
            [category: string]: {
                total: number;
                names: {
                    [name: string]: {
                        total: number;
                        conds: { [cond: string]: number };
                    };
                };
            };
        };
    };
};

// Reusable sortable header used on users page — copied/adapted for damaged page
const SortableHeader = ({
    children,
    sort_key,
    queryParams,
}: {
    children: ReactNode;
    sort_key: string;
    queryParams?: Record<string, string> | null;
}) => {
    const currentSort = (queryParams && queryParams.sort) || new URLSearchParams(window.location.search).get('sort') || '';
    const currentDirection = (queryParams && queryParams.direction) || new URLSearchParams(window.location.search).get('direction') || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    const href = (() => {
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('sort', sort_key);
            u.searchParams.set('direction', newDirection);
            return u.pathname + u.search;
        } catch {
            return `?sort=${encodeURIComponent(sort_key)}&direction=${encodeURIComponent(newDirection)}`;
        }
    })();

    return (
        <Link href={href} preserveState preserveScroll>
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

export default function DamagedIndexPage() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: '在庫管理', href: route('inventory.index') },
        { title: '破損在庫管理', href: 'inventory/damaged' },
    ];
    const page = usePage();
    // typed access to page props (minimal) to avoid `any`
    const pageProps = page.props as unknown as { auth?: { user?: { id?: number } } };
    const currentUserId = Number(pageProps.auth?.user?.id) || '';
    const [items, setItems] = useState<DamagedItem[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [damageConditions, setDamageConditions] = useState<DamageConditionOption[]>([]);

    const [form, setForm] = useState<FormState>({
        inventory_item_id: '',
        handler_user_id: currentUserId as number | '',
        management_number: '',
        damaged_at: new Date().toISOString().slice(0, 10),
        damage_condition_id: '',
        damaged_area: '',
        customer_name: '',
        customer_phone: '',
        customer_id_image: null,
        compensation_amount: '',
        payment_method: 'cash',
        receipt_number: '',
        receipt_image: null,
        memo: '',
    });

    // client-side limit for uploads
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    const [damagedAttachments, setDamagedAttachments] = useState<File[]>([]);
    const [damagedPreviews, setDamagedPreviews] = useState<{ url: string; file: File; isImage: boolean }[]>([]);
    const prevDamagedPreviewsRef = useRef<{ url: string }[]>([]);
    const damagedFileInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const formContainerRef = useRef<HTMLDivElement | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [customerIdPreviewUrl, setCustomerIdPreviewUrl] = useState<string | null>(null);
    const customerIdFileRef = useRef<HTMLInputElement | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isCustomerIdPreviewOpen, setIsCustomerIdPreviewOpen] = useState(false);
    const [listModalOpen, setListModalOpen] = useState(false);
    const [listModalImages, setListModalImages] = useState<string[]>([]);
    const [listModalStartIndex, setListModalStartIndex] = useState(0);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [existingAttachments, setExistingAttachments] = useState<{ id: number; file_path: string; url: string; original_name?: string }[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);
    const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
    const [removeExistingCustomerId, setRemoveExistingCustomerId] = useState(false);
    const [serverStats, setServerStats] = useState<StatsType | null>(null);
    // derive query params from Inertia page props if present, otherwise fallback to URLSearchParams
    const queryParams: Record<string, string> =
        (page.props as unknown as { queryParams?: Record<string, string> }).queryParams ||
        Object.fromEntries(new URLSearchParams(window.location.search).entries());

    // helper: Format DB date (use raw YYYY-MM-DD to avoid timezone shifts).
    const formatDbDate = (raw?: string | null) => {
        if (!raw) return '';
        const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return raw;
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
        let yy = y;
        const mm = mo;
        if (mm < 3) yy -= 1;
        const w = (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[mm - 1] + d) % 7;
        const wd = weekdays[w];
        return `${y}/${mo}/${d} (${wd})`;
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({
            inventory_item_id: '',
            handler_user_id: currentUserId as number | '',
            management_number: '',
            damaged_at: new Date().toISOString().slice(0, 10),
            damage_condition_id: '',
            damaged_area: '',
            customer_name: '',
            customer_phone: '',
            customer_id_image: null,
            compensation_amount: '',
            payment_method: 'cash',
            receipt_number: '',
            receipt_image: null,
            memo: '',
        });
        setDamagedAttachments([]);
        setDamagedPreviews([]);
        setExistingAttachments([]);
        setDeletedAttachmentIds([]);
        setRemoveExistingReceipt(false);
        setRemoveExistingCustomerId(false);
    };

    const startEdit = (it: DamagedItem) => {
        setEditingId(it.id);
        setShowForm(true);
        setForm({
            inventory_item_id: it.inventory_item?.id ? Number(it.inventory_item.id) : it.inventory_item_id ? Number(it.inventory_item_id) : '',
            handler_user_id: it.handler_user?.id ? Number(it.handler_user.id) : it.handler_user_id ? Number(it.handler_user_id) : currentUserId,
            management_number: it.management_number || '',
            damaged_at: it.damaged_at ? it.damaged_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            damage_condition_id: it.damage_condition_id || '',
            damaged_area: it.damaged_area || '',
            customer_name: it.customer_name || '',
            customer_phone: it.customer_phone || '',
            customer_id_image: null,
            compensation_amount: String(it.compensation_amount ?? ''),
            payment_method: it.payment_method || 'cash',
            receipt_number: it.receipt_number || '',
            receipt_image: null,
            memo: it.memo || '',
        });
        setPreviewUrl(it.receipt_image_path ? `/storage/${it.receipt_image_path}` : null);
        const existingCustomerPath = (it as unknown as { customer_id_image_path?: string }).customer_id_image_path || null;
        setCustomerIdPreviewUrl(existingCustomerPath ? `/storage/${existingCustomerPath}` : null);
        setDamagedAttachments([]);
        setDamagedPreviews([]);
        setRemoveExistingReceipt(false);
        setRemoveExistingCustomerId(false);
        setDeletedAttachmentIds([]);
        setExistingAttachments(
            ((it.attachments || []) as AttFull[])
                .filter((a) => a && a.file_path)
                .map((a) => ({ id: a.id, file_path: a.file_path, url: `/storage/${a.file_path}`, original_name: a.original_name })),
        );
        setTimeout(() => {
            try {
                if (formContainerRef.current) {
                    formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch {
                // ignore
            }
        }, 150);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const f = e.target.files[0];
        setForm({ ...form, receipt_image: f });
        setRemoveExistingReceipt(false);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(f));
        e.currentTarget.value = '';
    };
    // Server-driven stats panel: expects shape { [month]: { total, categories: { [cat]: { total, names: { [name]: { total, conds } } } } } }
    function StatsPanelServer({ stats }: { stats: StatsType | null }) {
        const months = useMemo(() => (stats ? Object.keys(stats).sort().reverse() : []), [stats]);

        const [monthsOpen, setMonthsOpen] = useState<Record<string, boolean>>(() => {
            const map: Record<string, boolean> = {};
            months.forEach((m) => (map[m] = true));
            return map;
        });

        const [catsOpen, setCatsOpen] = useState<Record<string, Record<string, boolean>>>(() => {
            const map: Record<string, Record<string, boolean>> = {};
            months.forEach((m) => {
                map[m] = {};
                const ckeys = stats && stats[m] ? Object.keys(stats[m].categories || {}) : [];
                ckeys.forEach((c) => (map[m][c] = true));
            });
            return map;
        });

        useEffect(() => {
            if (!stats) return;
            const statsJson = JSON.stringify(stats);
            // re-init when stats changes
            const mo: Record<string, boolean> = {};
            const co: Record<string, Record<string, boolean>> = {};
            months.forEach((m) => {
                mo[m] = true;
                co[m] = {};
                const ckeys = Object.keys(stats[m].categories || {});
                ckeys.forEach((c) => (co[m][c] = true));
            });
            setMonthsOpen(mo);
            setCatsOpen(co);
            // include statsJson and months so effect re-runs when stats/months change
        }, [months, stats]);

        const toggleMonth = (m: string) => setMonthsOpen((prev) => ({ ...prev, [m]: !prev[m] }));
        const toggleCat = (m: string, c: string) => setCatsOpen((prev) => ({ ...prev, [m]: { ...(prev[m] || {}), [c]: !(prev[m] || {})[c] } }));

        if (!stats || Object.keys(stats).length === 0) return <div className="text-sm text-gray-500">データがありません</div>;

        return (
            <div className="space-y-3 text-sm">
                {months.map((month) => {
                    const m = stats[month];
                    const cats = m.categories || {};
                    const isMonthOpen = monthsOpen[month] ?? true;
                    return (
                        <div key={month} className="rounded border-b pb-2">
                            <div className="flex items-center justify-between">
                                <button type="button" className="flex items-center gap-3" onClick={() => toggleMonth(month)}>
                                    <span
                                        className="inline-block transition-transform"
                                        style={{ transform: isMonthOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                    >
                                        ›
                                    </span>
                                    <div>
                                        {(() => {
                                            const parts = (month || '').split('-');
                                            const y = parts[0] || month;
                                            const mo = parts[1] ? parts[1].padStart(2, '0') : '';
                                            return (
                                                <div className="font-medium">
                                                    {y}/{mo} <span className="text-xs text-gray-600">({m.total})</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </button>
                            </div>

                            {isMonthOpen && (
                                <div className="mt-2 space-y-2 pl-2">
                                    {Object.keys(cats).map((catName) => {
                                        const cat = cats[catName];
                                        const isCatOpen = (catsOpen[month] && catsOpen[month][catName]) ?? true;
                                        return (
                                            <div key={catName} className="rounded border p-2">
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-3"
                                                        onClick={() => toggleCat(month, catName)}
                                                    >
                                                        <span
                                                            className="inline-block transition-transform"
                                                            style={{ transform: isCatOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                                        >
                                                            ›
                                                        </span>
                                                        <div className="font-semibold">{catName}</div>
                                                    </button>
                                                    <div className="text-xs text-gray-600">合計 {cat.total}</div>
                                                </div>

                                                {isCatOpen && (
                                                    <div className="mt-2 space-y-2 pl-3">
                                                        {Object.keys(cat.names || {}).map((nm) => {
                                                            const n = cat.names[nm];
                                                            return (
                                                                <div key={nm}>
                                                                    <div className="font-medium">
                                                                        {nm} <span className="text-xs text-gray-600">({n.total})</span>
                                                                    </div>
                                                                    <ul className="list-disc pl-6 text-sm">
                                                                        {Object.keys(n.conds || {}).map((cond) => (
                                                                            <li key={cond}>
                                                                                {cond}：{n.conds[cond]}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    const fetchList = async () => {
        try {
            // include sort/direction if present in URL query string
            const sp = new URLSearchParams(window.location.search);
            const sort = sp.get('sort');
            const direction = sp.get('direction');
            const params: Record<string, string> = {};
            if (sort) params.sort = sort;
            if (direction) params.direction = direction;
            const res = await axios.get('/api/damaged-inventories', { params });
            const payload = res.data || {};
            setItems(payload.damaged || payload.data || []);
            if (payload.inventory_items) {
                // サーバーが返す順序を尊重する（クライアント側で再ソートしない）
                setInventoryItems(payload.inventory_items as InventoryItemOption[]);
            }
            // ユーザー一覧は共通 API から取得する（フロント側で一貫させる）
            try {
                const ures = await axios.get('/api/active-users');
                setUsers(ures.data.users || []);
            } catch {
                // fall back to payload.users when available
                if (payload.users) setUsers(payload.users as UserOption[]);
            }
            if (payload.damage_conditions) setDamageConditions(payload.damage_conditions);
            // fetch server-side aggregated stats
            try {
                const sres = await axios.get('/api/damaged-inventories/stats');
                setServerStats(sres.data?.stats || null);
            } catch {
                setServerStats(null);
            }
        } catch {
            // ignore
        }
    };
    // load list on mount and when the Inertia page URL changes (so query params like sort/direction trigger reload)
    useEffect(() => {
        fetchList();
    }, [page.url]);
    useEffect(() => {
        // revoke previously created object URLs
        prevDamagedPreviewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
        if (!damagedAttachments || damagedAttachments.length === 0) {
            prevDamagedPreviewsRef.current = [];
            setDamagedPreviews([]);
            return;
        }
        const next = damagedAttachments.map((f) => ({
            url: URL.createObjectURL(f as File),
            file: f as File,
            isImage: (f as File).type.startsWith('image/'),
        }));
        setDamagedPreviews(next);
        prevDamagedPreviewsRef.current = next;
        return () => next.forEach((p) => URL.revokeObjectURL(p.url));
    }, [damagedAttachments]);

    const handleSubmit = async () => {
        setErrors({});

        // resolve required values, falling back to existing record when editing
        let invId: number | string = form.inventory_item_id;
        let handlerId: number | string = form.handler_user_id;
        let damagedAtVal: string = form.damaged_at;
        let damageConditionVal: number | string = form.damage_condition_id;
        if (editingId) {
            const existing = items.find((it) => it.id === editingId);
            if (existing) {
                if (!invId || invId === '') invId = existing.inventory_item?.id ?? existing.inventory_item_id ?? '';
                if (!handlerId || handlerId === '') handlerId = existing.handler_user?.id ?? existing.handler_user_id ?? '';
                if (!damagedAtVal) damagedAtVal = existing.damaged_at ? existing.damaged_at.slice(0, 10) : damagedAtVal;
                if (!damageConditionVal || damageConditionVal === '') damageConditionVal = existing.damage_condition_id ?? '';
            }
        }

        const fd = new FormData();
        fd.append('inventory_item_id', String(invId));
        fd.append('handler_user_id', String(handlerId));
        if (form.management_number) fd.append('management_number', String(form.management_number));
        fd.append('damaged_at', String(damagedAtVal));
        // append damage condition (required)
        if (damageConditionVal !== '' && damageConditionVal != null) {
            fd.append('damage_condition_id', String(damageConditionVal));
        }

        // client-side required validation for damage condition
        if (!damageConditionVal || damageConditionVal === '') {
            setErrors({ ...(errors || {}), damage_condition_id: ['破損状態を選択してください'] });
            return;
        }
        if (form.damaged_area) fd.append('damaged_area', String(form.damaged_area));
        if (form.customer_name) fd.append('customer_name', String(form.customer_name));
        if (form.customer_phone) fd.append('customer_phone', String(form.customer_phone));
        // include customer id image if present
        if (form.customer_id_image) fd.append('customer_id_image', form.customer_id_image as Blob);
        if (form.compensation_amount !== '') fd.append('compensation_amount', String(form.compensation_amount));
        if (form.payment_method) fd.append('payment_method', String(form.payment_method));
        if (form.receipt_number) fd.append('receipt_number', String(form.receipt_number));
        if (form.memo) fd.append('memo', String(form.memo));
        if (form.receipt_image) fd.append('receipt_image', form.receipt_image as Blob);
        if (damagedAttachments && damagedAttachments.length > 0) {
            damagedAttachments.forEach((f) => fd.append('damaged_area_images[]', f as Blob));
        }

        // append deletion flags if editing
        if (editingId) {
            if (deletedAttachmentIds && deletedAttachmentIds.length > 0) {
                deletedAttachmentIds.forEach((id) => fd.append('deleted_attachment_ids[]', String(id)));
            }
            if (removeExistingReceipt) fd.append('remove_receipt', '1');
            if (removeExistingCustomerId) fd.append('remove_customer_id', '1');
        }

        // quick sanity check: ensure required keys are present
        const appendedKeys: string[] = [];
        appendedKeys.push('inventory_item_id', 'handler_user_id', 'damaged_at');
        // if any required value is empty, we'll still send but warn in console
        if (!invId || invId === '' || !handlerId || handlerId === '' || !damagedAtVal) {
            console.warn('Submitting form with potentially empty required fields', { invId, handlerId, damagedAtVal });
        }

        try {
            if (editingId) {
                // include deletion flags
                if (deletedAttachmentIds && deletedAttachmentIds.length > 0) {
                    deletedAttachmentIds.forEach((id) => fd.append('deleted_attachment_ids[]', String(id)));
                }
                if (removeExistingReceipt) fd.append('remove_receipt', '1');

                // use POST with method override instead of direct PATCH
                fd.append('_method', 'PATCH');
                await axios.post(`/api/damaged-inventories/${editingId}`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                setToast({ message: '更新しました', type: 'success' });
            } else {
                await axios.post('/api/damaged-inventories', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                setToast({ message: '作成しました', type: 'success' });
            }
            setForm({
                inventory_item_id: '',
                handler_user_id: currentUserId as number | '',
                management_number: '',
                damaged_at: new Date().toISOString().slice(0, 10),
                damage_condition_id: '',
                damaged_area: '',
                customer_name: '',
                customer_phone: '',
                customer_id_image: null,
                compensation_amount: '',
                payment_method: 'cash',
                receipt_number: '',
                receipt_image: null,
                memo: '',
            });
            setDamagedAttachments([]);
            setDamagedPreviews([]);
            setExistingAttachments([]);
            setEditingId(null);
            setShowForm(false);
            fetchList();
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response && err.response.status === 422) {
                type ValidationErr = { errors?: Record<string, string[]> };
                setErrors((err.response.data as unknown as ValidationErr).errors || {});
            } else {
                setToast({ message: '作成に失敗しました', type: 'error' });
            }
        }
    };

    const renderFieldError = (field: string) => {
        const arr = errors[field] as string[] | undefined;
        if (!arr || arr.length === 0) return null;
        return <div className="text-sm text-red-600">{arr.join(' ')}</div>;
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="破損在庫管理" />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-4 flex items-start justify-between">
                    <div>
                        <Heading title="破損在庫管理" description="破損した在庫の登録と一覧" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={route('inventory.damage-conditions.index')}>
                            <Button size="sm" variant="ghost" className="whitespace-nowrap">
                                破損状態編集
                            </Button>
                        </Link>
                        <Button
                            className="flex items-center gap-2"
                            onClick={() => {
                                if (!showForm) {
                                    resetForm();
                                    setShowForm(true);
                                } else {
                                    setShowForm(false);
                                }
                            }}
                        >
                            <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                            {/* モバイルはアイコンのみ、sm以上でテキスト表示 */}
                            <span className="hidden sm:inline">{showForm ? 'フォームを閉じる' : '新規登録'}</span>
                        </Button>
                    </div>
                </div>

                {showForm && (
                    <div className="mb-6 flex justify-center" ref={formContainerRef}>
                        <div className="w-full lg:w-2/3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{editingId ? '編集' : '新規登録'}</CardTitle>
                                </CardHeader>
                                {/* existing attachments header removed; moved into photo area */}
                                <CardContent>
                                    {/* two-column layout on md and up; items that should take full width use col-span-2 */}
                                    <div className="space-y-3 md:grid md:gap-4 md:space-y-0">
                                        <div>
                                            <Label>
                                                在庫リスト（カテゴリ：名称） <span className="text-red-600">*</span>
                                            </Label>
                                            <SingleSelectCombobox
                                                options={inventoryItems.map((it) => ({
                                                    value: it.id,
                                                    label: it.category ? `${it.category.name}：${it.name}` : it.name,
                                                }))}
                                                selected={form.inventory_item_id || null}
                                                onChange={(val) => {
                                                    // val can be number|string|null or an option object
                                                    const unknownVal = val as unknown;
                                                    let v: number | string | null | '' = '';
                                                    if (unknownVal && typeof unknownVal === 'object') {
                                                        v = (unknownVal as { value?: number | string }).value ?? '';
                                                    } else {
                                                        v = (unknownVal as number | string | null) ?? '';
                                                    }
                                                    setForm({ ...form, inventory_item_id: v !== '' && v != null ? Number(v) : '' });
                                                }}
                                            />
                                            {renderFieldError('inventory_item_id')}
                                        </div>

                                        <div>
                                            <Label>
                                                対応者 <span className="text-red-600">*</span>
                                            </Label>
                                            <SingleSelectCombobox
                                                options={users.map((u) => ({ value: u.id, label: `${u.id} ${u.name}` }))}
                                                selected={form.handler_user_id || null}
                                                onChange={(val) => {
                                                    const unknownVal = val as unknown;
                                                    let v: number | string | null | '' = '';
                                                    if (unknownVal && typeof unknownVal === 'object') {
                                                        v = (unknownVal as { value?: number | string }).value ?? '';
                                                    } else {
                                                        v = (unknownVal as number | string | null) ?? '';
                                                    }
                                                    setForm({ ...form, handler_user_id: v !== '' && v != null ? Number(v) : '' });
                                                }}
                                            />
                                            {renderFieldError('handler_user_id')}
                                        </div>

                                        <div>
                                            <Label>管理番号</Label>
                                            <Input
                                                placeholder="管理番号を入力"
                                                value={form.management_number}
                                                onChange={(e) => setForm({ ...form, management_number: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <Label>
                                                破損日 <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                type="date"
                                                value={form.damaged_at}
                                                onChange={(e) => setForm({ ...form, damaged_at: e.target.value })}
                                            />
                                            {renderFieldError('damaged_at')}
                                        </div>

                                        <div>
                                            <Label>
                                                破損状態 <span className="text-red-600">*</span>
                                            </Label>
                                            <select
                                                className="w-full rounded border p-2"
                                                value={form.damage_condition_id}
                                                onChange={(e) =>
                                                    setForm({ ...form, damage_condition_id: e.target.value ? Number(e.target.value) : '' })
                                                }
                                            >
                                                <option value="">選択してください</option>
                                                {damageConditions.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.condition}
                                                    </option>
                                                ))}
                                            </select>
                                            {renderFieldError('damage_condition_id')}
                                        </div>

                                        <div>
                                            <Label>破損個所</Label>
                                            <Input
                                                placeholder="例: ソール, ノーズなど"
                                                value={form.damaged_area}
                                                onChange={(e) => setForm({ ...form, damaged_area: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <Label>破損個所（写真）</Label>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        ref={damagedFileInputRef}
                                                        id="damaged_input"
                                                        className="hidden"
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        onChange={(e) => {
                                                            if (!e.target.files) return;
                                                            const files = Array.from(e.target.files);
                                                            const accepted: File[] = [];
                                                            const errs: string[] = [];
                                                            const existing = new Set(damagedAttachments.map((f) => f.name));
                                                            files.forEach((f) => {
                                                                if (!f.type.startsWith('image/')) {
                                                                    errs.push(`${f.name} は画像形式ではありません`);
                                                                    return;
                                                                }
                                                                if (f.size && f.size > MAX_FILE_SIZE) {
                                                                    errs.push(`${f.name} は10MBを超えています`);
                                                                    return;
                                                                }
                                                                if (!existing.has(f.name)) {
                                                                    existing.add(f.name);
                                                                    accepted.push(f);
                                                                }
                                                            });
                                                            if (errs.length > 0)
                                                                setErrors((prev) => ({ ...(prev || {}), damaged_attachments: errs }));
                                                            else
                                                                setErrors((prev) => {
                                                                    const copy = { ...(prev || {}) } as Record<string, string[]>;
                                                                    delete copy.damaged_attachments;
                                                                    return copy;
                                                                });
                                                            if (accepted.length > 0) setDamagedAttachments((prev) => [...prev, ...accepted]);
                                                            e.currentTarget.value = '';
                                                        }}
                                                    />
                                                    <Button type="button" variant="outline" onClick={() => damagedFileInputRef.current?.click()}>
                                                        ファイル選択
                                                    </Button>
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    ※破損個所の写真は複数枚アップロードできます。ファイルは画像のみ、1ファイルあたり最大10MBです。
                                                </div>
                                                {renderFieldError('damaged_attachments')}

                                                <div className="mt-3 flex flex-wrap items-start gap-3">
                                                    {/* existing attachments first (when editing) */}
                                                    {existingAttachments.map((p, idx) => (
                                                        <div
                                                            key={`exist-in-damaged-${p.id}`}
                                                            className="relative h-20 w-20 overflow-hidden rounded bg-gray-50"
                                                        >
                                                            <img
                                                                src={p.url}
                                                                alt={`exist-att-${idx}`}
                                                                className="h-full w-full cursor-pointer object-cover"
                                                                onClick={() => {
                                                                    const existingImgs = existingAttachments.map((x) => x.url);
                                                                    const newImgs = damagedPreviews.map((d) => d.url);
                                                                    const imgs = existingImgs.concat(newImgs);
                                                                    setListModalImages(imgs);
                                                                    setListModalStartIndex(idx);
                                                                    setListModalOpen(true);
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-400"
                                                                onClick={() => {
                                                                    setDeletedAttachmentIds((prev) => [...prev, p.id]);
                                                                    setExistingAttachments((prev) => prev.filter((x) => x.id !== p.id));
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}

                                                    {/* newly selected files previews */}
                                                    {damagedPreviews.map((p, idx) => (
                                                        <div
                                                            key={`new-damaged-${idx}`}
                                                            className="relative h-20 w-20 overflow-hidden rounded bg-gray-50"
                                                        >
                                                            <img
                                                                src={p.url}
                                                                alt={`new-damaged-${idx}`}
                                                                className="h-full w-full cursor-pointer object-cover"
                                                                onClick={() => {
                                                                    const existingImgs = existingAttachments.map((x) => x.url);
                                                                    const newImgs = damagedPreviews.map((d) => d.url);
                                                                    const imgs = existingImgs.concat(newImgs);
                                                                    const start = existingImgs.length + idx;
                                                                    setListModalImages(imgs);
                                                                    setListModalStartIndex(start);
                                                                    setListModalOpen(true);
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-400"
                                                                onClick={() => {
                                                                    setDamagedAttachments((prev) => prev.filter((_, i) => i !== idx));
                                                                    setDamagedPreviews((prev) => prev.filter((_, i) => i !== idx));
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>顧客名</Label>
                                            <Input
                                                placeholder="顧客名を入力"
                                                value={form.customer_name}
                                                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                                            />
                                            {renderFieldError('customer_name')}
                                        </div>

                                        <div>
                                            <Label>顧客電話番号</Label>
                                            <Input
                                                placeholder="例: 03-1234-5678"
                                                value={form.customer_phone}
                                                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                                            />
                                            {renderFieldError('customer_phone')}
                                        </div>

                                        <div className="col-span-2">
                                            <Label>顧客身分証</Label>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        ref={customerIdFileRef}
                                                        id="customer_id_input"
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            if (!e.target.files || e.target.files.length === 0) return;
                                                            const f = e.target.files[0];
                                                            const errs: string[] = [];
                                                            if (!f.type.startsWith('image/')) errs.push('顧客身分証は画像ファイルのみです');
                                                            if (f.size && f.size > MAX_FILE_SIZE)
                                                                errs.push('顧客身分証は1ファイルあたり10MBまでです');
                                                            if (errs.length > 0) {
                                                                setErrors((prev) => ({ ...(prev || {}), customer_id_image: errs }));
                                                            } else {
                                                                setErrors((prev) => {
                                                                    const copy = { ...(prev || {}) } as Record<string, string[]>;
                                                                    delete copy.customer_id_image;
                                                                    return copy;
                                                                });
                                                                // selecting a new customer id image cancels previous remove flag
                                                                setRemoveExistingCustomerId(false);
                                                                setForm((prev) => ({ ...prev, customer_id_image: f }));
                                                                if (customerIdPreviewUrl) URL.revokeObjectURL(customerIdPreviewUrl);
                                                                setCustomerIdPreviewUrl(URL.createObjectURL(f));
                                                            }
                                                            e.currentTarget.value = '';
                                                        }}
                                                    />
                                                    <Button type="button" variant="outline" onClick={() => customerIdFileRef.current?.click()}>
                                                        ファイル選択
                                                    </Button>
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    ※顧客身分証は1枚のみアップロードしてください。画像のみ・1ファイルあたり最大10MBです。
                                                </div>
                                                {renderFieldError('customer_id_image')}

                                                <div className="mt-2 flex items-center gap-2">
                                                    {customerIdPreviewUrl && (
                                                        <div className="h-20 w-20 overflow-hidden rounded border">
                                                            <img
                                                                src={customerIdPreviewUrl}
                                                                alt="customer-id-preview"
                                                                className="h-full w-full cursor-pointer object-cover"
                                                                onClick={() => setIsCustomerIdPreviewOpen(true)}
                                                            />
                                                        </div>
                                                    )}
                                                    {customerIdPreviewUrl && (
                                                        <Button
                                                            className="bg-red-500 text-white hover:bg-red-300 hover:text-white"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                // mark customer id for removal when editing; otherwise just clear preview
                                                                if (editingId) setRemoveExistingCustomerId(true);
                                                                setForm((prev) => ({ ...prev, customer_id_image: null }));
                                                                setCustomerIdPreviewUrl(null);
                                                            }}
                                                        >
                                                            削除
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            {renderFieldError('customer_id_image')}
                                        </div>

                                        <div>
                                            <Label>弁済金額</Label>
                                            <Input
                                                type="number"
                                                placeholder="例: 5000"
                                                value={form.compensation_amount}
                                                onChange={(e) => setForm({ ...form, compensation_amount: e.target.value })}
                                            />
                                            {renderFieldError('compensation_amount')}
                                        </div>

                                        <div>
                                            <Label>支払い方法</Label>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="payment_method"
                                                        checked={form.payment_method === 'cash'}
                                                        onChange={() => setForm({ ...form, payment_method: 'cash' })}
                                                    />
                                                    <span>現金</span>
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="payment_method"
                                                        checked={form.payment_method === 'card'}
                                                        onChange={() => setForm({ ...form, payment_method: 'card' })}
                                                    />
                                                    <span>クレジットカード</span>
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="payment_method"
                                                        checked={form.payment_method === 'paypay'}
                                                        onChange={() => setForm({ ...form, payment_method: 'paypay' })}
                                                    />
                                                    <span>PayPay</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div>
                                            <Label>レシート番号</Label>
                                            <Input
                                                placeholder="レシート番号（任意）"
                                                value={form.receipt_number}
                                                onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <Label>レシート写真</Label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    ref={fileInputRef}
                                                    id="receipt_input"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (!e.target.files || e.target.files.length === 0) return;
                                                        const f = e.target.files[0];
                                                        const errs: string[] = [];
                                                        if (!f.type.startsWith('image/')) errs.push('レシートは画像ファイルのみです');
                                                        if (f.size && f.size > MAX_FILE_SIZE) errs.push('レシートは1ファイルあたり10MBまでです');
                                                        if (errs.length > 0) {
                                                            setErrors((prev) => ({ ...(prev || {}), receipt_image: errs }));
                                                        } else {
                                                            setErrors((prev) => {
                                                                const copy = { ...(prev || {}) } as Record<string, string[]>;
                                                                delete copy.receipt_image;
                                                                return copy;
                                                            });
                                                            handleFileChange(e);
                                                        }
                                                    }}
                                                />
                                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                    ファイル選択
                                                </Button>
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                ※レシート写真は1枚のみアップロードしてください。画像のみ・1ファイルあたり最大10MBです。
                                            </div>
                                            {renderFieldError('receipt_image')}

                                            <div className="mt-2 flex items-center gap-2">
                                                {form.receipt_image ? (
                                                    <>
                                                        <div className="h-20 w-20 overflow-hidden rounded border">
                                                            <img
                                                                src={previewUrl || ''}
                                                                alt="preview"
                                                                className="h-full w-full cursor-pointer object-cover"
                                                                onClick={() => setIsPreviewOpen(true)}
                                                            />
                                                        </div>
                                                        <Button
                                                            className="bg-red-500 text-white hover:bg-red-300 hover:text-white"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                // clear selected file and its preview
                                                                setForm({ ...form, receipt_image: null });
                                                                try {
                                                                    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                                                                } catch {
                                                                    /* ignore */
                                                                }
                                                                setPreviewUrl(null);
                                                            }}
                                                        >
                                                            削除
                                                        </Button>
                                                    </>
                                                ) : previewUrl && editingId && !removeExistingReceipt ? (
                                                    <>
                                                        <div className="h-20 w-20 overflow-hidden rounded border">
                                                            <img
                                                                src={previewUrl}
                                                                alt="existing-receipt"
                                                                className="h-full w-full cursor-pointer object-cover"
                                                                onClick={() => setIsPreviewOpen(true)}
                                                            />
                                                        </div>
                                                        <Button
                                                            className="bg-red-500 text-white hover:bg-red-300 hover:text-white"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setRemoveExistingReceipt(true);
                                                                try {
                                                                    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                                                                } catch {
                                                                    // ignore
                                                                }
                                                                setPreviewUrl(null);
                                                            }}
                                                        >
                                                            削除
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>

                                            {renderFieldError('receipt_image')}
                                        </div>

                                        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                                            <DialogTrigger asChild>
                                                <div />
                                            </DialogTrigger>
                                            <DialogContent>
                                                {previewUrl && <img src={previewUrl} alt="preview-large" className="h-auto w-full" />}
                                            </DialogContent>
                                        </Dialog>

                                        <Dialog open={isCustomerIdPreviewOpen} onOpenChange={setIsCustomerIdPreviewOpen}>
                                            <DialogTrigger asChild>
                                                <div />
                                            </DialogTrigger>
                                            <DialogContent>
                                                {customerIdPreviewUrl && (
                                                    <img src={customerIdPreviewUrl} alt="customer-id-large" className="h-auto w-full" />
                                                )}
                                            </DialogContent>
                                        </Dialog>

                                        <div className="col-span-2">
                                            <Label>メモ</Label>
                                            <Textarea
                                                rows={3}
                                                placeholder="メモ（最大3行程度）"
                                                value={form.memo}
                                                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-span-2 flex justify-end pt-2">
                                            <Button onClick={handleSubmit}>{editingId ? '更新' : '登録'}</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>一覧</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    {/* Mobile: card list */}
                                    <div className="space-y-3 md:hidden">
                                        {items.map((it: DamagedItem) => {
                                            const thumb = (it.attachments || []).find((a: Att) => a && a.file_path);
                                            return (
                                                <div key={`m-${it.id}`} className="rounded border p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1">
                                                            <div className="text-sm text-gray-600">
                                                                {formatDbDate(it.damaged_at ? it.damaged_at.slice(0, 10) : it.damaged_at)}
                                                            </div>
                                                            <div className="mt-1 font-medium">
                                                                {it.inventory_item
                                                                    ? `${it.inventory_item.name || ''} ${it.management_number ? `[${it.management_number}]` : ''}`
                                                                    : '—'}
                                                            </div>
                                                            <div className="mt-1 text-sm text-gray-500">
                                                                {it.handler_user ? `${it.handler_user.id} ${it.handler_user.name}` : ''}
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 flex-col items-end gap-2">
                                                            {thumb ? (
                                                                <img
                                                                    src={`/storage/${thumb.file_path}`}
                                                                    alt="thumb"
                                                                    className="h-14 w-14 rounded object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-14 w-14 items-center justify-center rounded bg-gray-50 text-xs">
                                                                    画像なし
                                                                </div>
                                                            )}
                                                            <Button
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    startEdit(it);
                                                                }}
                                                            >
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                編集
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3">
                                                        <button
                                                            type="button"
                                                            className="text-sm text-blue-600"
                                                            onClick={() => setExpandedId(expandedId === it.id ? null : it.id)}
                                                        >
                                                            {expandedId === it.id ? '詳細を閉じる' : '詳細を表示'}
                                                        </button>
                                                    </div>

                                                    {expandedId === it.id && (
                                                        <div className="mt-3 text-sm text-gray-700">
                                                            <div className="mb-2">
                                                                <span className="text-gray-600">破損状態: </span>
                                                                {it.damage_condition?.condition || '—'}
                                                            </div>
                                                            <div className="mb-2">
                                                                <span className="text-gray-600">破損個所: </span>
                                                                {it.damaged_area || '—'}
                                                            </div>

                                                            <div className="mb-2">
                                                                <span className="text-gray-600">顧客名: </span>
                                                                {it.customer_name || '—'}
                                                            </div>

                                                            <div className="mb-2">
                                                                <span className="text-gray-600">顧客電話番号: </span>
                                                                {it.customer_phone || '—'}
                                                            </div>

                                                            <div className="mb-2">
                                                                <span className="text-gray-600">弁済金額: </span>
                                                                {it.compensation_amount || it.compensation_amount === 0
                                                                    ? `¥${new Intl.NumberFormat('ja-JP').format(Number(it.compensation_amount))}`
                                                                    : '—'}
                                                            </div>

                                                            <div className="mb-2">
                                                                <span className="text-gray-600">支払い方法: </span>
                                                                {it.payment_method === 'cash'
                                                                    ? '現金'
                                                                    : it.payment_method === 'card'
                                                                      ? 'クレジットカード'
                                                                      : it.payment_method === 'paypay'
                                                                        ? 'PayPay'
                                                                        : '—'}
                                                            </div>

                                                            <div className="mb-2">
                                                                <span className="text-gray-600">レシート番号: </span>
                                                                {it.receipt_number || '—'}
                                                            </div>

                                                            <div className="mb-2">
                                                                <span className="text-gray-600">メモ: </span>
                                                                <div className="whitespace-pre-wrap">{it.memo || '—'}</div>
                                                            </div>

                                                            <div className="mt-3">
                                                                <div className="text-sm text-gray-600">顧客身分証</div>
                                                                {it.customer_id_image_path ? (
                                                                    <div className="mt-2 flex items-center gap-3">
                                                                        <img
                                                                            src={`/storage/${it.customer_id_image_path}`}
                                                                            alt="customer-id"
                                                                            className="h-24 w-24 cursor-pointer rounded object-cover"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const imgs = [`/storage/${it.customer_id_image_path}`];
                                                                                setListModalImages(imgs);
                                                                                setListModalStartIndex(0);
                                                                                setListModalOpen(true);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm">—</div>
                                                                )}
                                                            </div>

                                                            <div className="mt-3">
                                                                <div className="text-sm text-gray-600">レシート</div>
                                                                {it.receipt_image_path ? (
                                                                    <div className="mt-2 flex items-center gap-3">
                                                                        <img
                                                                            src={`/storage/${it.receipt_image_path}`}
                                                                            alt="receipt"
                                                                            className="h-24 w-24 cursor-pointer rounded object-cover"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const imgs = [
                                                                                    ...(it.customer_id_image_path
                                                                                        ? [`/storage/${it.customer_id_image_path}`]
                                                                                        : []),
                                                                                    `/storage/${it.receipt_image_path}`,
                                                                                    ...(it.attachments || [])
                                                                                        .filter((a: Att) => a && a.file_path)
                                                                                        .map((a: Att) => `/storage/${a.file_path}`),
                                                                                ];
                                                                                setListModalImages(imgs);
                                                                                setListModalStartIndex(it.customer_id_image_path ? 0 : 0);
                                                                                setListModalOpen(true);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm">—</div>
                                                                )}
                                                            </div>

                                                            <div className="mt-3">
                                                                <div className="text-sm text-gray-600">破損個所（写真）</div>
                                                                <div className="mt-2 flex flex-wrap items-start gap-3">
                                                                    {(() => {
                                                                        const valid = (it.attachments || []).filter((a: Att) => a && a.file_path);
                                                                        if (valid.length === 0) return <div className="text-sm">—</div>;
                                                                        return valid.map((a: Att, idx: number) => {
                                                                            const url = `/storage/${a.file_path}`;
                                                                            return (
                                                                                <div
                                                                                    key={`m-att-${it.id}-${idx}`}
                                                                                    className="relative h-20 w-20 overflow-hidden rounded bg-gray-50"
                                                                                >
                                                                                    <img
                                                                                        src={url}
                                                                                        alt={`att-${idx}`}
                                                                                        className="h-full w-full cursor-pointer object-cover"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const imgs = valid.map(
                                                                                                (x: Att) => `/storage/${x.file_path}`,
                                                                                            );
                                                                                            const allImgs = (
                                                                                                it.customer_id_image_path
                                                                                                    ? [`/storage/${it.customer_id_image_path}`]
                                                                                                    : []
                                                                                            ).concat(imgs);
                                                                                            const start = allImgs.indexOf(url);
                                                                                            setListModalImages(allImgs);
                                                                                            setListModalStartIndex(start >= 0 ? start : 0);
                                                                                            setListModalOpen(true);
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Desktop/table for md and up */}
                                    <div className="hidden w-full overflow-x-auto md:block">
                                        <table className="w-full table-auto">
                                            <thead>
                                                <tr className="border-b border-gray-200 text-left text-sm text-muted-foreground">
                                                    <th className="p-2">
                                                        <SortableHeader sort_key="damaged_at" queryParams={queryParams}>
                                                            破損日
                                                        </SortableHeader>
                                                    </th>
                                                    <th className="p-2">
                                                        <SortableHeader sort_key="inventory_item.name" queryParams={queryParams}>
                                                            名称 [管理番号]
                                                        </SortableHeader>
                                                    </th>
                                                    <th className="p-2">
                                                        <SortableHeader sort_key="handler_user.name" queryParams={queryParams}>
                                                            担当者
                                                        </SortableHeader>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((it) => (
                                                    <Fragment key={it.id}>
                                                        <tr
                                                            key={`row-${it.id}`}
                                                            className="cursor-pointer border-b hover:bg-gray-50"
                                                            onClick={() => setExpandedId(expandedId === it.id ? null : it.id)}
                                                        >
                                                            <td className="p-2 align-middle text-sm">
                                                                {formatDbDate(it.damaged_at ? it.damaged_at.slice(0, 10) : it.damaged_at)}
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">
                                                                {it.inventory_item
                                                                    ? `${it.inventory_item.name || ''} ${it.management_number ? `[${it.management_number}]` : ''}`
                                                                    : '—'}
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">
                                                                {it.handler_user ? `${it.handler_user.id} ${it.handler_user.name}` : ''}
                                                            </td>
                                                            <td className="p-2 align-middle text-sm">
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEdit(it);
                                                                    }}
                                                                >
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    編集
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                        {expandedId === it.id && (
                                                            <tr key={`exp-${it.id}`}>
                                                                <td colSpan={3} className="bg-gray-50 p-4">
                                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                                        <div>
                                                                            <dl className="grid grid-cols-1 gap-y-2 text-sm">
                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">在庫</dt>
                                                                                    <dd className="w-2/3">
                                                                                        {it.inventory_item?.category?.name
                                                                                            ? `${it.inventory_item.category.name}：${it.inventory_item?.name}`
                                                                                            : it.inventory_item?.name || '—'}
                                                                                    </dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">管理番号</dt>
                                                                                    <dd className="w-2/3">{it.management_number || '—'}</dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">破損日</dt>
                                                                                    <dd className="w-2/3">
                                                                                        {it.damaged_at
                                                                                            ? formatDbDate(it.damaged_at.slice(0, 10))
                                                                                            : '—'}
                                                                                    </dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">対応者</dt>
                                                                                    <dd className="w-2/3">
                                                                                        {it.handler_user
                                                                                            ? `${it.handler_user.id} ${it.handler_user.name}`
                                                                                            : '—'}
                                                                                    </dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">破損状態</dt>
                                                                                    <dd className="w-2/3">{it.damage_condition?.condition || '—'}</dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">破損個所</dt>
                                                                                    <dd className="w-2/3">{it.damaged_area || '—'}</dd>
                                                                                </div>

                                                                                {/* Customer & payment details shown under damaged area */}
                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">顧客名</dt>
                                                                                    <dd className="w-2/3">{it.customer_name || '—'}</dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">顧客電話番号</dt>
                                                                                    <dd className="w-2/3">{it.customer_phone || '—'}</dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">弁済金額</dt>
                                                                                    <dd className="w-2/3">
                                                                                        {it.compensation_amount || it.compensation_amount === 0
                                                                                            ? `¥${new Intl.NumberFormat('ja-JP').format(Number(it.compensation_amount))}`
                                                                                            : '—'}
                                                                                    </dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">支払い方法</dt>
                                                                                    <dd className="w-2/3">
                                                                                        {it.payment_method === 'cash'
                                                                                            ? '現金'
                                                                                            : it.payment_method === 'card'
                                                                                              ? 'クレジットカード'
                                                                                              : it.payment_method === 'paypay'
                                                                                                ? 'PayPay'
                                                                                                : '—'}
                                                                                    </dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">レシート番号</dt>
                                                                                    <dd className="w-2/3">{it.receipt_number || '—'}</dd>
                                                                                </div>

                                                                                <div className="flex items-start justify-between">
                                                                                    <dt className="w-1/3 text-gray-600">メモ</dt>
                                                                                    <dd className="w-2/3 whitespace-pre-wrap">{it.memo || '—'}</dd>
                                                                                </div>
                                                                            </dl>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm text-gray-600">顧客身分証</div>
                                                                            {it.customer_id_image_path ? (
                                                                                <div className="mt-2 flex items-center gap-3">
                                                                                    <img
                                                                                        src={`/storage/${it.customer_id_image_path}`}
                                                                                        alt="customer-id"
                                                                                        className="h-28 w-28 cursor-pointer rounded object-cover"
                                                                                        onClick={() => {
                                                                                            const imgs = [
                                                                                                `/storage/${it.customer_id_image_path}`,
                                                                                                ...(it.receipt_image_path
                                                                                                    ? [`/storage/${it.receipt_image_path}`]
                                                                                                    : []),
                                                                                                ...(it.attachments || [])
                                                                                                    .filter((a: Att) => a && a.file_path)
                                                                                                    .map((a: Att) => `/storage/${a.file_path}`),
                                                                                            ];
                                                                                            setListModalImages(imgs);
                                                                                            setListModalStartIndex(0);
                                                                                            setListModalOpen(true);
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-sm">—</div>
                                                                            )}

                                                                            <div className="mt-3 text-sm text-gray-600">レシート</div>
                                                                            {it.receipt_image_path ? (
                                                                                <div className="mt-2 flex items-center gap-3">
                                                                                    <img
                                                                                        src={`/storage/${it.receipt_image_path}`}
                                                                                        alt="receipt"
                                                                                        className="h-28 w-28 cursor-pointer rounded object-cover"
                                                                                        onClick={() => {
                                                                                            const imgs = [
                                                                                                ...(it.customer_id_image_path
                                                                                                    ? [`/storage/${it.customer_id_image_path}`]
                                                                                                    : []),
                                                                                                `/storage/${it.receipt_image_path}`,
                                                                                                ...(it.attachments || [])
                                                                                                    .filter((a: Att) => a && a.file_path)
                                                                                                    .map((a: Att) => `/storage/${a.file_path}`),
                                                                                            ];
                                                                                            const start = it.customer_id_image_path ? 1 : 0;
                                                                                            setListModalImages(imgs);
                                                                                            setListModalStartIndex(start);
                                                                                            setListModalOpen(true);
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-sm">—</div>
                                                                            )}

                                                                            <div className="mt-3 text-sm text-gray-600">破損個所（写真）</div>
                                                                            <div className="mt-2 flex flex-wrap items-start gap-3">
                                                                                {(() => {
                                                                                    type Att = { file_path?: string };
                                                                                    const valid = ((it.attachments || []) as Att[]).filter(
                                                                                        (a) => a && a.file_path,
                                                                                    );
                                                                                    if (valid.length === 0) return <div className="text-sm">—</div>;
                                                                                    return valid.map((a: Att, idx: number) => {
                                                                                        const url = `/storage/${a.file_path}`;
                                                                                        return (
                                                                                            <div
                                                                                                key={`att-${it.id}-${idx}`}
                                                                                                className="relative h-20 w-20 overflow-hidden rounded bg-gray-50"
                                                                                            >
                                                                                                <img
                                                                                                    src={url}
                                                                                                    alt={`att-${idx}`}
                                                                                                    className="h-full w-full cursor-pointer object-cover"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        const imgs = valid.map(
                                                                                                            (x: Att) => `/storage/${x.file_path}`,
                                                                                                        );
                                                                                                        const start = imgs.indexOf(url);
                                                                                                        setListModalImages(imgs);
                                                                                                        setListModalStartIndex(
                                                                                                            start >= 0 ? start : 0,
                                                                                                        );
                                                                                                        setListModalOpen(true);
                                                                                                    }}
                                                                                                />
                                                                                            </div>
                                                                                        );
                                                                                    });
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>月別統計</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <StatsPanelServer stats={serverStats} />
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {listModalOpen && <ImageModal images={listModalImages} startIndex={listModalStartIndex} onClose={() => setListModalOpen(false)} />}
            </div>
        </AppSidebarLayout>
    );
}
