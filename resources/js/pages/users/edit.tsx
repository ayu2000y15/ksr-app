import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// ...existing code...
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

// パンくずリスト
const breadcrumbs = [
    { title: 'ユーザー管理', href: route('users.index') },
    { title: '編集', href: '' },
];

export default function EditUserPage() {
    const pageProps = usePage().props as unknown as { flash?: any; user: any; credentials?: any; rentalItems?: any[]; currentRentals?: any[] };
    const flash = pageProps.flash || null;
    const user: any = pageProps.user;
    const credentials = pageProps.credentials || (flash && flash.credentials) || null;
    const rentalItems = pageProps.rentalItems || [];
    const currentRentals = pageProps.currentRentals || [];

    // 現在貸出中のアイテムIDの配列を取得
    const currentRentalItemIds = currentRentals.map((r: any) => r.rental_item_id);

    const { data, setData, post, patch, processing, errors } = useForm({
        name: user.name || '',
        furigana: user.furigana || '',
        email: user.email || '',
        status: user.status || 'active',
        gender: user.gender ?? '',
        has_car: typeof user.has_car === 'boolean' ? user.has_car : false,
        phone_number: user.phone_number || '',
        line_name: user.line_name || '',
        memo: user.memo || '',
        employment_condition: user.employment_condition || '',
        commute_method: user.commute_method || '',
        default_start_time: user.default_start_time || '',
        default_end_time: user.default_end_time || '',
        preferred_week_days: Array.isArray(user.preferred_week_days)
            ? user.preferred_week_days
            : user.preferred_week_days
              ? JSON.parse(user.preferred_week_days)
              : [],
        preferred_week_days_count: user.preferred_week_days_count ?? '',
        employment_start_date: user.employment_start_date || '',
        employment_end_date: user.employment_end_date || '',
        employment_notes: user.employment_notes || '',
        profile_image: null as File | null,
        remove_profile_image: false,
        new_rental_items: [] as number[], // 新規貸出するアイテムID
        return_rental_items: [] as number[], // 返却するアイテムID
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (typeof post === 'function') {
            // build a debug FormData (for developer console) so we can see what will be sent
            try {
                const dbg = new FormData();
                dbg.append('_method', 'PATCH');
                Object.entries(data).forEach(([k, v]) => {
                    if (v === undefined || v === null) return;
                    if (k === 'profile_image') return;
                    if (Array.isArray(v)) {
                        v.forEach((item) => dbg.append(`${k}[]`, typeof item === 'object' ? JSON.stringify(item) : String(item)));
                    } else {
                        dbg.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
                    }
                });
                const f = (data as any).profile_image as File | null;
                if (f) dbg.append('profile_image', f);
                try {
                    console.log('[users.edit] FormData entries:', Array.from(dbg.entries()));
                } catch (e) {
                    // ignore console errors
                }
            } catch (e) {
                // ignore debug build errors
            }

            post(route('users.update', user.id), {
                forceFormData: true,
                // add method override into submitted payload without mutating local data
                transform: (payload: any) => ({ ...payload, _method: 'PATCH' }),
            } as any);
            return;
        }

        if (typeof patch === 'function') {
            patch(route('users.update', user.id), { forceFormData: true });
        }
    };

    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(
        flash && flash.success ? { message: flash.success, type: 'success' } : flash && flash.error ? { message: flash.error, type: 'error' } : null,
    );

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            console.error('コピーに失敗しました');
        }
    };

    // restore sent flag by strictly matching stored credentials to current credentials — only when credentials exist
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const sentKey = `user_credentials_sent_${user.email}`;

            if (!credentials) {
                // if we don't have credentials to show, never restore sent (avoid blocking send button)
                setSent(false);
                return;
            }

            // Prefer direct stored creds for this user.email
            const credKey = `user_credentials_${user.email}`;
            const stored = sessionStorage.getItem(credKey);

            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    const sameEmail = parsed && parsed.email && credentials.email && parsed.email.toLowerCase() === credentials.email.toLowerCase();
                    const sameTemp =
                        parsed &&
                        parsed.temporary_password &&
                        credentials.temporary_password &&
                        parsed.temporary_password === credentials.temporary_password;
                    if (sameEmail && sameTemp) {
                        setSent(sessionStorage.getItem(sentKey) === '1');
                        return;
                    }
                } catch {
                    // fall through to clear
                }
            }

            // No matching stored credentials -> clear sent
            sessionStorage.removeItem(sentKey);
            setSent(false);
        } catch {
            // ignore
        }
    }, [user.email, credentials]);

    // prepare display values: always show name/email; temporary password kept in state so we can update it
    const displayName = credentials?.name ?? user.name ?? '';
    const displayEmail = credentials?.email ?? user.email ?? '';
    const [displayTemp, setDisplayTemp] = useState<string | null>(credentials?.temporary_password ?? null);
    const [regenerating, setRegenerating] = useState(false);

    useEffect(() => {
        // if credentials prop provides a temp password, use it
        if (credentials && credentials.temporary_password) {
            setDisplayTemp(credentials.temporary_password);
            return;
        }

        // otherwise try to find a stored temporary password for this email in sessionStorage
        if (typeof window === 'undefined') return;
        try {
            const key = `user_credentials_${displayEmail}`;
            const stored = sessionStorage.getItem(key);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.temporary_password) {
                        setDisplayTemp(parsed.temporary_password);
                        return;
                    }
                } catch {
                    // ignore parse errors
                }
            }

            // scan entries as fallback
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (!k) continue;
                if (!k.startsWith('user_credentials_')) continue;
                try {
                    const v = sessionStorage.getItem(k);
                    if (!v) continue;
                    const parsed = JSON.parse(v);
                    if (
                        parsed &&
                        parsed.email &&
                        String(parsed.email).toLowerCase() === String(displayEmail).toLowerCase() &&
                        parsed.temporary_password
                    ) {
                        setDisplayTemp(parsed.temporary_password);
                        break;
                    }
                } catch {
                    // ignore parse errors
                }
            }
        } catch {
            // ignore
        }
    }, [credentials, displayEmail]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー編集" />

            <div className="py-12">
                <div className="mx-auto max-w-4xl sm:px-6 lg:px-8">
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>ユーザー情報編集</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="name">
                                        名前 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    <InputError message={errors.name} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="furigana">フリガナ</Label>
                                    <Input id="furigana" value={data.furigana} onChange={(e) => setData('furigana', e.target.value)} />
                                    <InputError message={errors.furigana} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="email">
                                        メールアドレス <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} required />
                                    <InputError message={errors.email} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="status">
                                        ステータス <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="active"
                                                checked={data.status === 'active'}
                                                onChange={() => setData('status', 'active')}
                                            />
                                            <span>アクティブ</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="retired"
                                                checked={data.status === 'retired'}
                                                onChange={() => setData('status', 'retired')}
                                            />
                                            <span>退職</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="shared"
                                                checked={data.status === 'shared'}
                                                onChange={() => setData('status', 'shared')}
                                            />
                                            <span>共有アカウント</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.status} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="gender">
                                        性別 <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="male"
                                                checked={data.gender === 'male'}
                                                onChange={() => setData('gender', 'male')}
                                                required
                                            />
                                            <span>男性</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="female"
                                                checked={data.gender === 'female'}
                                                onChange={() => setData('gender', 'female')}
                                            />
                                            <span>女性</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.gender} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="has_car">
                                        車の有無 <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="has_car"
                                                value="1"
                                                checked={data.has_car === true}
                                                onChange={() => setData('has_car', true)}
                                                required
                                            />
                                            <span>有</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="has_car"
                                                value="0"
                                                checked={data.has_car === false}
                                                onChange={() => setData('has_car', false)}
                                            />
                                            <span>無</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.has_car} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="phone_number">電話番号</Label>
                                    <Input id="phone_number" value={data.phone_number} onChange={(e) => setData('phone_number', e.target.value)} />
                                    <InputError message={errors.phone_number} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="line_name">LINE名</Label>
                                    <Input id="line_name" value={data.line_name} onChange={(e) => setData('line_name', e.target.value)} />
                                    <InputError message={errors.line_name} className="mt-2" />
                                </div>

                                <div>
                                    <Label>採用条件</Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="employment_condition"
                                                value="dormitory"
                                                checked={data.employment_condition === 'dormitory'}
                                                onChange={() => setData('employment_condition', 'dormitory')}
                                            />
                                            <span>寮</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="employment_condition"
                                                value="commute"
                                                checked={data.employment_condition === 'commute'}
                                                onChange={() => setData('employment_condition', 'commute')}
                                            />
                                            <span>通勤</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="commute_method">通勤方法</Label>
                                    <Input
                                        id="commute_method"
                                        value={data.commute_method}
                                        onChange={(e) => setData('commute_method', e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <div>
                                        <Label htmlFor="default_start_time">基本出勤開始時間</Label>
                                        <Input
                                            id="default_start_time"
                                            type="time"
                                            value={data.default_start_time}
                                            onChange={(e) => setData('default_start_time', e.target.value)}
                                        />
                                    </div>
                                    ~
                                    <div>
                                        <Label htmlFor="default_end_time">基本出勤終了時間</Label>
                                        <Input
                                            id="default_end_time"
                                            type="time"
                                            value={data.default_end_time}
                                            onChange={(e) => setData('default_end_time', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="preferred_week_days_count">週休希望日数</Label>
                                    <Input
                                        id="preferred_week_days_count"
                                        type="number"
                                        value={data.preferred_week_days_count}
                                        onChange={(e) => setData('preferred_week_days_count', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label>固定休希望（あれば）</Label>
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                        {[
                                            { value: 'Mon', label: '月' },
                                            { value: 'Tue', label: '火' },
                                            { value: 'Wed', label: '水' },
                                            { value: 'Thu', label: '木' },
                                            { value: 'Fri', label: '金' },
                                            { value: 'Sat', label: '土' },
                                            { value: 'Sun', label: '日' },
                                        ].map((d) => (
                                            <label key={d.value} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={Array.isArray(data.preferred_week_days) && data.preferred_week_days.includes(d.value)}
                                                    onChange={(e) => {
                                                        const arr = Array.isArray(data.preferred_week_days) ? [...data.preferred_week_days] : [];
                                                        if (e.currentTarget.checked) arr.push(d.value);
                                                        else {
                                                            const idx = arr.indexOf(d.value);
                                                            if (idx >= 0) arr.splice(idx, 1);
                                                        }
                                                        setData('preferred_week_days', arr);
                                                    }}
                                                />
                                                <span className="text-xs">{d.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="employment_start_date">勤務開始日</Label>
                                        <Input
                                            id="employment_start_date"
                                            type="date"
                                            value={data.employment_start_date}
                                            onChange={(e) => setData('employment_start_date', e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Label htmlFor="employment_end_date">勤務終了日</Label>
                                        <Input
                                            id="employment_end_date"
                                            type="date"
                                            value={data.employment_end_date}
                                            onChange={(e) => setData('employment_end_date', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="employment_notes">勤務備考欄</Label>
                                    <Textarea
                                        id="employment_notes"
                                        rows={3}
                                        value={data.employment_notes}
                                        onChange={(e) => setData('employment_notes', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="memo">その他メモ</Label>
                                    <Textarea id="memo" value={data.memo} onChange={(e) => setData('memo', e.target.value)} />
                                    <InputError message={errors.memo} className="mt-2" />
                                </div>

                                {/* 貸出物選択 */}
                                {rentalItems.length > 0 && (
                                    <div>
                                        <Label>貸出物</Label>

                                        {/* 現在貸出中のアイテム */}
                                        {currentRentals.length > 0 && (
                                            <div className="mt-2">
                                                <div className="mb-2 text-sm font-medium text-gray-700">貸出中</div>
                                                <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-4">
                                                    {currentRentals.map((rental: any) => (
                                                        <div key={rental.id} className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <span className="text-sm font-medium text-gray-900">{rental.rental_item?.name}</span>
                                                                {rental.rental_item?.description && (
                                                                    <span className="ml-2 text-xs text-gray-500">
                                                                        ({rental.rental_item.description})
                                                                    </span>
                                                                )}
                                                                <div className="mt-1 text-xs text-gray-600">
                                                                    貸出日: {new Date(rental.rental_date).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    if (!data.return_rental_items.includes(rental.rental_item_id)) {
                                                                        setData('return_rental_items', [
                                                                            ...data.return_rental_items,
                                                                            rental.rental_item_id,
                                                                        ]);
                                                                    }
                                                                }}
                                                                disabled={data.return_rental_items.includes(rental.rental_item_id)}
                                                                className={
                                                                    data.return_rental_items.includes(rental.rental_item_id) ? 'bg-gray-200' : ''
                                                                }
                                                            >
                                                                {data.return_rental_items.includes(rental.rental_item_id) ? '返却予定' : '返却'}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 新規貸出可能なアイテム */}
                                        <div className="mt-4">
                                            <div className="mb-2 text-sm font-medium text-gray-700">新規貸出</div>
                                            <div className="space-y-2 rounded-md border p-4">
                                                {rentalItems
                                                    .filter((item: any) => !currentRentalItemIds.includes(item.id))
                                                    .map((item: any) => (
                                                        <div key={item.id} className="flex items-center space-x-2">
                                                            <input
                                                                type="checkbox"
                                                                id={`rental-item-${item.id}`}
                                                                checked={data.new_rental_items.includes(item.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setData('new_rental_items', [...data.new_rental_items, item.id]);
                                                                    } else {
                                                                        setData(
                                                                            'new_rental_items',
                                                                            data.new_rental_items.filter((id: number) => id !== item.id),
                                                                        );
                                                                    }
                                                                }}
                                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <label
                                                                htmlFor={`rental-item-${item.id}`}
                                                                className="cursor-pointer text-sm font-medium text-gray-700"
                                                            >
                                                                {item.name}
                                                                {item.description && (
                                                                    <span className="ml-2 text-xs text-gray-500">({item.description})</span>
                                                                )}
                                                            </label>
                                                        </div>
                                                    ))}
                                                {rentalItems.filter((item: any) => !currentRentalItemIds.includes(item.id)).length === 0 && (
                                                    <p className="text-sm text-gray-500">新規貸出可能なアイテムはありません</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label>従業員証用顔写真（3cm × 4cm）</Label>
                                    <div className="mt-2">
                                        <div className="flex items-center gap-3">
                                            <input
                                                ref={fileInputRef}
                                                id="profile_image"
                                                className="hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                                    // revoke previous preview if any
                                                    if (preview) {
                                                        try {
                                                            URL.revokeObjectURL(preview);
                                                        } catch {}
                                                    }
                                                    if (f) {
                                                        const url = URL.createObjectURL(f);
                                                        setPreview(url);
                                                        setData('profile_image', f);
                                                        // clear any prior remove flag when a new file is chosen
                                                        setData('remove_profile_image', false);
                                                    } else {
                                                        setPreview(null);
                                                        setData('profile_image', null);
                                                    }
                                                }}
                                            />
                                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                ファイル選択
                                            </Button>
                                            <div className="text-sm text-muted-foreground">
                                                {preview
                                                    ? '1 ファイル選択中'
                                                    : !data.remove_profile_image && user.profile_image
                                                      ? '既存の画像あり'
                                                      : '未選択'}
                                            </div>
                                            {preview && (
                                                <button
                                                    type="button"
                                                    className="ml-2 text-sm text-red-500"
                                                    onClick={() => {
                                                        // clear selection
                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                        try {
                                                            if (preview) URL.revokeObjectURL(preview);
                                                        } catch {}
                                                        setPreview(null);
                                                        setData('profile_image', null);
                                                    }}
                                                >
                                                    選択解除
                                                </button>
                                            )}
                                        </div>

                                        <div className="mt-3">
                                            {preview ? (
                                                <div
                                                    className="relative inline-block overflow-hidden bg-gray-50"
                                                    style={{ width: '3cm', height: '4cm' }}
                                                >
                                                    <img src={preview} alt="preview" className="h-full w-full object-cover" />
                                                    <button
                                                        type="button"
                                                        className="absolute top-1 right-1 rounded bg-white/80 p-0.5 text-gray-700 hover:bg-white"
                                                        onClick={() => {
                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                            try {
                                                                if (preview) URL.revokeObjectURL(preview);
                                                            } catch {}
                                                            setPreview(null);
                                                            setData('profile_image', null);
                                                        }}
                                                        title="削除"
                                                    >
                                                        <svg
                                                            className="h-4 w-4"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                        >
                                                            <path d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ) : !data.remove_profile_image && user.profile_image ? (
                                                <div
                                                    className="relative inline-block overflow-hidden bg-gray-50"
                                                    style={{ width: '3cm', height: '4cm' }}
                                                >
                                                    <img
                                                        src={
                                                            (user.profile_image &&
                                                                (user.profile_image.match(/^https?:\/\//)
                                                                    ? user.profile_image
                                                                    : `/storage/${user.profile_image}`)) ||
                                                            ''
                                                        }
                                                        alt="current"
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="absolute top-1 right-1 rounded bg-white/80 p-0.5 text-red-600 hover:bg-white"
                                                        onClick={() => {
                                                            // mark for removal and clear any selected file preview
                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                            try {
                                                                if (preview) URL.revokeObjectURL(preview);
                                                            } catch {}
                                                            setPreview(null);
                                                            setData('profile_image', null);
                                                            setData('remove_profile_image', true);
                                                        }}
                                                        title="既存画像を削除"
                                                    >
                                                        <svg
                                                            className="h-4 w-4"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                        >
                                                            <path d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('users.index')}>
                                    <Button variant="outline" type="button">
                                        キャンセル
                                    </Button>
                                </Link>
                                <Button disabled={processing}>更新する</Button>
                            </CardFooter>
                        </Card>
                    </form>

                    {/* must_change_password が true の場合、パスワード未変更の注意と認証情報を表示 */}
                    {user.must_change_password && (
                        <div className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>登録完了 - ログイン情報（未パスワード変更）</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="mb-2">
                                        このアカウントは初回ログイン時にパスワード変更が必要です。
                                        <br />
                                        招待メールを送信する場合は、送信ボタンを押してください。
                                        <br />
                                        仮パスワードが表示されない場合、再作成を行ってから送信してください。
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <div className="mb-2">
                                                <Label>メールアドレス</Label>
                                                <div className="rounded-md bg-gray-100 p-2">{displayEmail}</div>
                                            </div>
                                            <div>
                                                <Label>仮パスワード</Label>
                                                <div className="rounded-md bg-gray-100 p-2 font-mono">{displayTemp ?? '（表示できません）'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex items-center justify-between">
                                    <div>
                                        <Button
                                            variant="ghost"
                                            title="仮パスワードが表示されない場合は再作成します"
                                            onClick={async () => {
                                                if (regenerating) return;
                                                setRegenerating(true);
                                                try {
                                                    const metaToken =
                                                        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                                    const xsrfCookie = (document.cookie || '').split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
                                                    const xsrfValue = xsrfCookie ? decodeURIComponent(xsrfCookie.split('=')[1]) : '';

                                                    const res = await fetch(route('users.credentials.regenerate', user.id), {
                                                        method: 'POST',
                                                        credentials: 'include',
                                                        headers: {
                                                            Accept: 'application/json',
                                                            'X-Requested-With': 'XMLHttpRequest',
                                                            'Content-Type': 'application/json',
                                                            'X-CSRF-TOKEN': metaToken,
                                                            'X-XSRF-TOKEN': xsrfValue,
                                                        },
                                                    });
                                                    let json = null;
                                                    try {
                                                        json = await res.json();
                                                    } catch {
                                                        // ignore
                                                    }
                                                    if (res.ok && json && json.temporary_password) {
                                                        setDisplayTemp(json.temporary_password);
                                                        try {
                                                            const key = `user_credentials_${displayEmail}`;
                                                            const stored = sessionStorage.getItem(key);
                                                            let parsed = stored ? JSON.parse(stored) : {};
                                                            parsed = Object.assign(parsed || {}, {
                                                                email: displayEmail,
                                                                temporary_password: json.temporary_password,
                                                                name: displayName,
                                                            });
                                                            sessionStorage.setItem(key, JSON.stringify(parsed));

                                                            // Clear any previous "sent" flag because this is a new temporary password
                                                            const sentKey = `user_credentials_sent_${displayEmail}`;
                                                            sessionStorage.removeItem(sentKey);
                                                            setSent(false);
                                                        } catch {
                                                            // ignore
                                                        }
                                                        setToast({ message: (json && json.message) || '再作成しました', type: 'success' });
                                                    } else {
                                                        setToast({ message: (json && json.error) || '再作成に失敗しました', type: 'error' });
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    setToast({ message: '再作成に失敗しました', type: 'error' });
                                                } finally {
                                                    setRegenerating(false);
                                                }
                                            }}
                                        >
                                            再作成
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            disabled={sending || sent || regenerating}
                                            aria-busy={sending}
                                            onClick={async () => {
                                                if (sending || sent || regenerating) return;
                                                // confirm before sending to avoid accidental sends
                                                try {
                                                    const confirmed = window.confirm(`${displayEmail}に招待メールを送信してよろしいですか？`);
                                                    if (!confirmed) return;
                                                } catch {
                                                    // if confirm is not available, proceed as before
                                                }
                                                setSending(true);
                                                try {
                                                    const metaToken =
                                                        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                                    const xsrfCookie = (document.cookie || '').split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
                                                    const xsrfValue = xsrfCookie ? decodeURIComponent(xsrfCookie.split('=')[1]) : '';

                                                    const res = await fetch(route('users.credentials.send', user.id), {
                                                        method: 'POST',
                                                        // include cookies so Laravel session / CSRF token are available
                                                        credentials: 'include',
                                                        headers: {
                                                            Accept: 'application/json',
                                                            'X-Requested-With': 'XMLHttpRequest',
                                                            'Content-Type': 'application/json',
                                                            'X-CSRF-TOKEN': metaToken,
                                                            'X-XSRF-TOKEN': xsrfValue,
                                                        },
                                                    });
                                                    let json = null;
                                                    try {
                                                        json = await res.json();
                                                    } catch {
                                                        // non-json response (e.g., HTML redirect)
                                                    }
                                                    if (res.ok) {
                                                        setToast({ message: (json && json.message) || '送信しました', type: 'success' });
                                                        setSent(true);
                                                        try {
                                                            const sentKey = `user_credentials_sent_${displayEmail}`;
                                                            sessionStorage.setItem(sentKey, '1');
                                                        } catch {
                                                            // ignore
                                                        }
                                                    } else {
                                                        setToast({
                                                            message: (json && json.error) || `送信に失敗しました (HTTP ${res.status})`,
                                                            type: 'error',
                                                        });
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    setToast({ message: '送信に失敗しました', type: 'error' });
                                                } finally {
                                                    setSending(false);
                                                }
                                            }}
                                        >
                                            {sending ? (
                                                <>
                                                    <svg
                                                        className="mr-2 -ml-1 h-5 w-5 animate-spin text-white"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        ></circle>
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                        ></path>
                                                    </svg>
                                                    送信中
                                                </>
                                            ) : sent ? (
                                                '送信済み'
                                            ) : (
                                                '送信'
                                            )}
                                        </Button>

                                        <Button
                                            onClick={() => {
                                                const rawLogin = route('login');
                                                const loginUrl =
                                                    typeof rawLogin === 'string' && rawLogin.match(/^https?:\/\//)
                                                        ? rawLogin
                                                        : typeof window !== 'undefined'
                                                          ? window.location.origin + rawLogin
                                                          : rawLogin;

                                                copyText(
                                                    `名前：${displayName}\nログインID：${displayEmail}\n仮パスワード：${displayTemp ?? '（表示できません）'}\nログインページ：${loginUrl}\n`,
                                                );
                                            }}
                                        >
                                            コピー
                                        </Button>
                                        {copied && <div className="ml-3 text-sm text-green-600">コピーしました</div>}
                                    </div>
                                </CardFooter>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </AppSidebarLayout>
    );
}
