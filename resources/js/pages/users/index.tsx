/* eslint-disable @typescript-eslint/no-explicit-any */
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge'; // Badgeコンポーネントをインポート
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
// types are intentionally typed as any in this file to avoid strict type dependency
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Car, Download, Edit, Eye, GripVertical, LoaderCircle, Plus, Trash } from 'lucide-react';
import { Fragment, ReactNode, useEffect, useState } from 'react';
// dialog modal removed: details now open on a separate page

// パンくずリストの定義
const breadcrumbs = [{ title: 'ユーザー管理', href: route('users.index') }];

// 並び替え可能なテーブルヘッダーのコンポーネント
const SortableHeader = ({ children, sort_key, queryParams }: { children: ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'id';
    const currentDirection = queryParams?.direction || 'asc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    return (
        <Link href={route('users.index', { sort: sort_key, direction: newDirection })} preserveState preserveScroll>
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

export default function Index({ users: initialUsers, queryParams = {} }: any) {
    const [users, setUsers] = useState<any[]>(initialUsers.data);
    const [nextPageUrl, setNextPageUrl] = useState(initialUsers.next_page_url);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<number[]>([]);

    useEffect(() => {
        setUsers(initialUsers.data);
        setNextPageUrl(initialUsers.next_page_url);
    }, [initialUsers]);

    const loadMore = () => {
        if (!nextPageUrl) return;

        setLoading(true);
        router.get(
            nextPageUrl,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    const newUsers = (page.props.users as any).data;
                    const nextPage = (page.props.users as any).next_page_url;
                    setUsers((prevUsers) => [...prevUsers, ...newUsers]);
                    setNextPageUrl(nextPage);
                    setLoading(false);
                },
                onError: () => {
                    setLoading(false);
                },
            },
        );
    };

    const toggleExpand = (id: number) => {
        setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const confirmAndDelete = (user: any) => {
        if (!confirm(`ユーザー「${user.name}」を削除してもよろしいですか？この操作は取り消せません。`)) {
            return;
        }

        router.delete(route('users.destroy', user.id), {
            preserveState: false,
            onError: () => {},
        });
    };

    // ステータスに応じてBadgeコンポーネントを返す関数
    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">アクティブ</Badge>;
            case 'retired':
                return <Badge className="bg-red-100 text-red-800">退職</Badge>;
            case 'shared':
                return <Badge variant="default">共有アカウント</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const page = usePage();
    const { permissions } = page.props as any;

    // helper to ensure time is shown as HH:MM (minutes included)
    const formatTime = (t: any) => {
        if (!t && t !== 0) return '—';
        try {
            const s = String(t).trim();
            // if already hh:mm or hh:mm:ss
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
                const parts = s.split(':');
                const hh = parts[0].padStart(2, '0');
                const mm = parts[1] || '00';
                return `${hh}:${mm}`;
            }
            // if only hour number like '9' or '09'
            if (/^\d{1,2}$/.test(s)) {
                return `${s.padStart(2, '0')}:00`;
            }
            // try Date parse fallback
            const d = new Date(s);
            if (!isNaN(d.getTime())) {
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                return `${hh}:${mm}`;
            }
            return s;
        } catch {
            return String(t);
        }
    };

    const weekdayMap: Record<string, string> = {
        Mon: '月',
        Tue: '火',
        Wed: '水',
        Thu: '木',
        Fri: '金',
        Sat: '土',
        Sun: '日',
    };

    const orderedWeekdayCodes = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const normalizeToCode = (v: any): string | null => {
        if (v === null || typeof v === 'undefined') return null;
        const s = String(v).trim();
        if (!s) return null;
        if (orderedWeekdayCodes.includes(s)) return s;
        // Japanese single char like '月'
        const foundKey = Object.keys(weekdayMap).find((k) => weekdayMap[k] === s);
        if (foundKey) return foundKey;
        // try first three letters (e.g., Monday -> Mon)
        const first3 = s.slice(0, 3);
        const cap = first3.charAt(0).toUpperCase() + first3.slice(1).toLowerCase();
        if (orderedWeekdayCodes.includes(cap)) return cap;
        return null;
    };

    const getPreferredDayCodesFromUser = (user: any): string[] => {
        const raw = Array.isArray(user.preferred_week_days)
            ? user.preferred_week_days
            : user.preferred_week_days
              ? JSON.parse(user.preferred_week_days)
              : [];
        const codes = raw.map((d: any) => normalizeToCode(d)).filter((x: string | null): x is string => Boolean(x));
        return Array.from(new Set(codes));
    };

    const getPreferredDaysOrdered = (user: any): string[] => {
        const codes = getPreferredDayCodesFromUser(user);
        return orderedWeekdayCodes.filter((c) => codes.includes(c));
    };

    // download helper: if same-origin or relative path, use anchor download; otherwise fetch blob then download
    const downloadImage = async (src: string, filename?: string) => {
        try {
            const isRelative = src.startsWith('/');
            const origin = window.location.origin;
            const isSameOrigin = src.startsWith(origin) || isRelative;
            const name = filename || `${(Math.random() + 1).toString(36).substring(7)}.jpg`;

            if (isSameOrigin) {
                const a = document.createElement('a');
                a.href = src;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                return;
            }

            const res = await fetch(src, { mode: 'cors' });
            if (!res.ok) throw new Error('network');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            console.error(err);
            alert('画像のダウンロードに失敗しました');
        }
    };

    // 詳細は別ページへ遷移します

    // 権限チェック関数
    const canViewUsers = permissions?.user?.view || permissions?.is_system_admin;
    const canCreateUsers = permissions?.user?.create || permissions?.is_system_admin;
    const canUpdateUsers = permissions?.user?.update || permissions?.is_system_admin;
    const canDeleteUsers = permissions?.user?.delete || permissions?.is_system_admin;

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー管理" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="ユーザー管理" description="ユーザーの一覧・編集・削除" />
                </div>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>ユーザー一覧</CardTitle>
                        <div className="flex gap-2">
                            <Link href={route('rental-items.index')}>
                                <Button variant="outline">
                                    <span className="hidden sm:inline">貸出物マスタ</span>
                                    <span className="sm:hidden">貸出物</span>
                                </Button>
                            </Link>
                            {canCreateUsers && (
                                <Link href={route('users.create')}>
                                    <Button>
                                        <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">新規作成</span>
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Mobile: stacked card list (no horizontal scroll) */}
                        <div className="space-y-3 md:hidden">
                            {users.map((user: any) => (
                                <div key={user.id} className={`relative cursor-pointer rounded-md border p-4 hover:bg-gray-50`}>
                                    <div onClick={() => toggleExpand(user.id)}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        {user.furigana && (
                                                            <div className="truncate text-[10px] text-muted-foreground">{user.furigana}</div>
                                                        )}
                                                        <div
                                                            className={`truncate text-sm font-medium ${
                                                                user.gender === 'male'
                                                                    ? 'text-blue-600'
                                                                    : user.gender === 'female'
                                                                      ? 'text-red-600'
                                                                      : 'text-foreground'
                                                            }`}
                                                        >
                                                            {user.name}
                                                        </div>
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {user.roles && user.roles.length > 0 ? (
                                                            user.roles.map((r: any) => r.name).join(', ')
                                                        ) : (
                                                            <span className="text-xs">未登録</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-1 truncate text-xs text-muted-foreground">LINE名：{user.line_name || '—'}</div>
                                            </div>

                                            <div className="flex flex-col items-end space-y-2">
                                                <div className="text-xs text-muted-foreground">ID: {user.position ?? user.id}</div>
                                                <div>{renderStatusBadge(user.status)}</div>
                                                <div className="text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        {user.has_car && (
                                            <div className="absolute bottom-3 left-3">
                                                <span
                                                    role="img"
                                                    aria-label="車あり"
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-600 shadow-sm"
                                                >
                                                    <Car className="h-4 w-4" />
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {expandedIds.includes(user.id) && (
                                        <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground md:flex-row">
                                            <div className="flex-1">
                                                <div className="grid gap-2">
                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">採用条件</div>
                                                        <div className="flex-1">
                                                            {user.employment_condition === 'dormitory'
                                                                ? '寮'
                                                                : user.employment_condition === 'commute'
                                                                  ? '通勤'
                                                                  : '—'}
                                                        </div>
                                                    </div>

                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">通勤方法</div>
                                                        <div className="flex-1">{user.commute_method || '—'}</div>
                                                    </div>

                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">基本出勤時間</div>
                                                        <div className="flex-1">
                                                            {formatTime(user.default_start_time)} 〜 {formatTime(user.default_end_time)}
                                                        </div>
                                                    </div>

                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">週休希望日数</div>
                                                        <div className="flex-1">
                                                            {user.preferred_week_days_count != null ? `${user.preferred_week_days_count}日` : '—'}
                                                        </div>
                                                    </div>

                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">固定休希望</div>
                                                        <div className="flex-1">
                                                            {(() => {
                                                                const ordered = getPreferredDaysOrdered(user);
                                                                return ordered.length > 0 ? ordered.map((d) => weekdayMap[d] || d).join(' ') : '—';
                                                            })()}
                                                        </div>
                                                    </div>

                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">勤務期間</div>
                                                        <div className="flex-1">
                                                            {user.employment_start_date ? user.employment_start_date.replace(/-/g, '/') : '—'}～
                                                            {user.employment_end_date ? user.employment_end_date.replace(/-/g, '/') : '—'}
                                                        </div>
                                                    </div>

                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">勤務備考</div>
                                                        <div className="flex-1 whitespace-pre-line">{user.employment_notes || '—'}</div>
                                                    </div>

                                                    <div className="flex">
                                                        <div className="w-36 text-sm text-muted-foreground">メモ</div>
                                                        <div className="flex-1 whitespace-pre-line">{user.memo || '—'}</div>
                                                    </div>

                                                    {/* 貸出リスト */}
                                                    {user.rentals && user.rentals.length > 0 && (
                                                        <div className="mt-4">
                                                            <div className="mb-2 text-sm font-semibold text-foreground">貸出リスト</div>
                                                            <div className="space-y-2">
                                                                {user.rentals.map((rental: any) => (
                                                                    <div key={rental.id} className="rounded border bg-white p-2 text-xs">
                                                                        <div className="font-medium">{rental.rental_item?.name || '—'}</div>
                                                                        <div className="mt-1 text-muted-foreground">
                                                                            貸出日: {new Date(rental.rental_date).toLocaleDateString()} / 対応者:{' '}
                                                                            {rental.rental_user?.name || '—'}
                                                                        </div>
                                                                        {rental.return_date && (
                                                                            <div className="text-muted-foreground">
                                                                                返却日: {new Date(rental.return_date).toLocaleDateString()} / 対応者:{' '}
                                                                                {rental.return_user?.name || '—'}
                                                                            </div>
                                                                        )}
                                                                        {rental.notes && (
                                                                            <div className="mt-1 text-muted-foreground">備考: {rental.notes}</div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {user.profile_image
                                                        ? (() => {
                                                              const src = user.profile_image.match(/^https?:\/\//)
                                                                  ? user.profile_image
                                                                  : `/storage/${user.profile_image}`;
                                                              return (
                                                                  <div className="ml-4 w-48 flex-shrink-0">
                                                                      <div className="relative">
                                                                          <img
                                                                              src={src}
                                                                              alt={`${user.name || 'user'} profile`}
                                                                              className="h-24 w-18 cursor-pointer rounded object-cover"
                                                                              onClick={(e) => {
                                                                                  e.stopPropagation();
                                                                                  downloadImage(src, `${user.name || 'profile'}.jpg`);
                                                                              }}
                                                                          />
                                                                          <button
                                                                              type="button"
                                                                              onClick={(e) => {
                                                                                  e.stopPropagation();
                                                                                  downloadImage(src, `${user.name || 'profile'}.jpg`);
                                                                              }}
                                                                              className="absolute right-0 bottom-0 m-1 rounded bg-white p-1 shadow"
                                                                              aria-label="ダウンロード"
                                                                          >
                                                                              <Download className="h-4 w-4 text-gray-700" />
                                                                          </button>
                                                                      </div>
                                                                  </div>
                                                              );
                                                          })()
                                                        : null}

                                                    <div className="mt-2 flex items-center justify-end gap-2">
                                                        {canViewUsers && (
                                                            <Link href={route('users.show', user.id)} onClick={(e: any) => e.stopPropagation()}>
                                                                <Button size="sm" variant="outline" className="p-2">
                                                                    <Eye className="mr-0 h-4 w-4 sm:mr-2" />
                                                                    <span className="hidden sm:inline">詳細</span>
                                                                </Button>
                                                            </Link>
                                                        )}
                                                        {canUpdateUsers && (
                                                            <Link href={route('users.edit', user.id)} onClick={(e: any) => e.stopPropagation()}>
                                                                <Button variant="outline" size="sm" className="p-2">
                                                                    <Edit className="mr-0 h-4 w-4 sm:mr-2" />
                                                                    <span className="hidden sm:inline">編集</span>
                                                                </Button>
                                                            </Link>
                                                        )}
                                                        {canDeleteUsers && (
                                                            <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(user)}>
                                                                <Trash className="h-4 w-4 sm:mr-2" />
                                                                <span className="hidden sm:inline">削除</span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Desktop / Tablet: table view */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>
                                            {/* ドラッグハンドル列 */}
                                            <div className="sr-only">並び替え</div>
                                        </TableHead>
                                        <TableHead>
                                            <SortableHeader sort_key="id" queryParams={queryParams}>
                                                ID
                                            </SortableHeader>
                                        </TableHead>
                                        <TableHead>
                                            <SortableHeader sort_key="name" queryParams={queryParams}>
                                                名前
                                            </SortableHeader>
                                        </TableHead>
                                        <TableHead>
                                            <SortableHeader sort_key="email" queryParams={queryParams}>
                                                LINE名
                                            </SortableHeader>
                                        </TableHead>
                                        <TableHead>
                                            <SortableHeader sort_key="status" queryParams={queryParams}>
                                                ステータス
                                            </SortableHeader>
                                        </TableHead>
                                        <TableHead>
                                            <SortableHeader sort_key="created_at" queryParams={queryParams}>
                                                登録日
                                            </SortableHeader>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user: any) => (
                                        <Fragment key={`user-${user.id}`}>
                                            <TableRow
                                                key={user.id}
                                                className="cursor-pointer hover:bg-gray-50"
                                                onClick={() => toggleExpand(user.id)}
                                                draggable={true}
                                                onDragStart={(e) => {
                                                    e.dataTransfer?.setData('text/plain', String(user.id));
                                                    e.dataTransfer!.effectAllowed = 'move';
                                                    // highlight drag source
                                                    e.currentTarget.classList.add('opacity-60');
                                                }}
                                                onDragEnd={(e) => {
                                                    e.currentTarget.classList.remove('opacity-60');
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.dataTransfer!.dropEffect = 'move';
                                                    const target = e.currentTarget as HTMLElement;
                                                    target.classList.add('bg-gray-100');
                                                }}
                                                onDragLeave={(e) => {
                                                    const target = e.currentTarget as HTMLElement;
                                                    target.classList.remove('bg-gray-100');
                                                }}
                                                onDrop={async (e) => {
                                                    e.preventDefault();
                                                    const target = e.currentTarget as HTMLElement;
                                                    target.classList.remove('bg-gray-100');

                                                    const draggedId = Number(e.dataTransfer?.getData('text/plain'));
                                                    const targetId = user.id;
                                                    if (!draggedId || draggedId === targetId) return;

                                                    // build new order array
                                                    const old = [...users];
                                                    const fromIndex = old.findIndex((u) => u.id === draggedId);
                                                    const toIndex = old.findIndex((u) => u.id === targetId);
                                                    if (fromIndex < 0 || toIndex < 0) return;

                                                    const [moved] = old.splice(fromIndex, 1);
                                                    old.splice(toIndex, 0, moved);

                                                    // Optimistically update UI
                                                    const reordered = old.map((u, i) => ({ ...u, position: i + 1 }));
                                                    setUsers(reordered);

                                                    // send updated order to server (ids array)
                                                    try {
                                                        const response = await axios.post('/api/users/reorder', { ids: old.map((u) => u.id) });
                                                        console.log('並び順を保存しました:', response.data);
                                                    } catch (err) {
                                                        console.error('reorder failed', err);
                                                        alert('並び順の保存に失敗しました。ページをリロードしてください。');
                                                        // Revert to original order on error
                                                        setUsers(initialUsers.data);
                                                    }
                                                }}
                                            >
                                                <TableCell>
                                                    <button
                                                        aria-label="ドラッグして並び替え"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="hidden h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-600 md:inline-flex"
                                                    >
                                                        <GripVertical className="h-4 w-4" />
                                                    </button>
                                                </TableCell>
                                                <TableCell>{user.position ?? user.id}</TableCell>
                                                <TableCell>
                                                    <div className="flex w-full items-center gap-3">
                                                        <div className={`flex items-center gap-3`}>
                                                            <div>
                                                                {user.furigana && (
                                                                    <div className="text-[10px] text-muted-foreground">{user.furigana}</div>
                                                                )}
                                                                <span
                                                                    className={`${user.gender === 'male' ? 'text-blue-600' : user.gender === 'female' ? 'text-red-600' : ''}`}
                                                                >
                                                                    {user.name}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm text-muted-foreground">
                                                                {user.roles && user.roles.length > 0 ? (
                                                                    user.roles.map((r: any) => r.name).join(', ')
                                                                ) : (
                                                                    <span className="text-xs">未登録</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        {user.has_car && (
                                                            <div className="ml-auto">
                                                                <span
                                                                    role="img"
                                                                    aria-label="車あり"
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-600 shadow-sm"
                                                                >
                                                                    <Car className="h-4 w-4" />
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{user.line_name}</TableCell>
                                                <TableCell>{renderStatusBadge(user.status)}</TableCell>
                                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    {canViewUsers && (
                                                        <Link href={route('users.show', user.id)} onClick={(e: any) => e.stopPropagation()}>
                                                            <Button size="sm" variant="outline" className="mr-2">
                                                                <Eye className="mr-2 h-4 w-4" /> 詳細
                                                            </Button>
                                                        </Link>
                                                    )}
                                                    {canUpdateUsers && (
                                                        <Link href={route('users.edit', user.id)} onClick={(e: any) => e.stopPropagation()}>
                                                            <Button variant="outline" className="mr-2">
                                                                <Edit className="mr-2 h-4 w-4" /> 編集
                                                            </Button>
                                                        </Link>
                                                    )}
                                                    {canDeleteUsers && (
                                                        <Button variant="destructive" size="sm" onClick={() => confirmAndDelete(user)}>
                                                            <Trash className="mr-2 h-4 w-4" /> 削除
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {expandedIds.includes(user.id) && (
                                                <TableRow key={`expanded-${user.id}`}>
                                                    <TableCell colSpan={6} className="bg-gray-50">
                                                        <div className="p-3 text-sm text-muted-foreground">
                                                            <div className="grid gap-2">
                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">採用条件</div>
                                                                    <div className="flex-1">
                                                                        {user.employment_condition === 'dormitory'
                                                                            ? '寮'
                                                                            : user.employment_condition === 'commute'
                                                                              ? '通勤'
                                                                              : '—'}
                                                                    </div>
                                                                </div>

                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">通勤方法</div>
                                                                    <div className="flex-1">{user.commute_method || '—'}</div>
                                                                </div>

                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">基本出勤時間</div>
                                                                    <div className="flex-1">
                                                                        {formatTime(user.default_start_time)} 〜 {formatTime(user.default_end_time)}
                                                                    </div>
                                                                </div>

                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">週休希望日数</div>
                                                                    <div className="flex-1">
                                                                        {user.preferred_week_days_count != null
                                                                            ? `${user.preferred_week_days_count}日`
                                                                            : '—'}
                                                                    </div>
                                                                </div>

                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">固定休希望</div>
                                                                    <div className="flex-1">
                                                                        {(() => {
                                                                            const ordered = getPreferredDaysOrdered(user);
                                                                            return ordered.length > 0
                                                                                ? ordered.map((d) => weekdayMap[d] || d).join(' ')
                                                                                : '—';
                                                                        })()}
                                                                    </div>
                                                                </div>

                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">勤務期間</div>
                                                                    <div className="flex-1">
                                                                        {user.employment_start_date
                                                                            ? user.employment_start_date.replace(/-/g, '/')
                                                                            : '—'}
                                                                        ～
                                                                        {user.employment_end_date ? user.employment_end_date.replace(/-/g, '/') : '—'}
                                                                    </div>
                                                                </div>

                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">勤務備考</div>
                                                                    <div className="flex-1 whitespace-pre-line">{user.employment_notes || '—'}</div>
                                                                </div>

                                                                <div className="flex">
                                                                    <div className="w-36 text-sm text-muted-foreground">メモ</div>
                                                                    <div className="flex-1 whitespace-pre-line">{user.memo || '—'}</div>
                                                                </div>

                                                                {/* 貸出リスト */}
                                                                {user.rentals && user.rentals.length > 0 && (
                                                                    <div className="mt-4">
                                                                        <div className="mb-2 text-sm font-semibold text-foreground">貸出リスト</div>
                                                                        <div className="space-y-2">
                                                                            {user.rentals.map((rental: any) => (
                                                                                <div key={rental.id} className="rounded border bg-white p-2 text-xs">
                                                                                    <div className="font-medium">
                                                                                        {rental.rental_item?.name || '—'}
                                                                                    </div>
                                                                                    <div className="mt-1 text-muted-foreground">
                                                                                        貸出日: {new Date(rental.rental_date).toLocaleDateString()} |
                                                                                        対応者: {rental.rental_user?.name || '—'}
                                                                                    </div>
                                                                                    {rental.return_date && (
                                                                                        <div className="text-muted-foreground">
                                                                                            返却日:{' '}
                                                                                            {new Date(rental.return_date).toLocaleDateString()} |
                                                                                            対応者: {rental.return_user?.name || '—'}
                                                                                        </div>
                                                                                    )}
                                                                                    {rental.notes && (
                                                                                        <div className="mt-1 text-muted-foreground">
                                                                                            備考: {rental.notes}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* プロフィール画像 (展開時の一番下に表示、3:4 長方形) */}
                                                                {user.profile_image
                                                                    ? (() => {
                                                                          const src = user.profile_image.match(/^https?:\/\//)
                                                                              ? user.profile_image
                                                                              : `/storage/${user.profile_image}`;
                                                                          return (
                                                                              <div className="mt-3">
                                                                                  <div className="relative inline-block">
                                                                                      <img
                                                                                          src={src}
                                                                                          alt={`${user.name || 'user'} profile`}
                                                                                          className="h-24 w-18 cursor-pointer rounded object-cover"
                                                                                          onClick={(e) => {
                                                                                              e.stopPropagation();
                                                                                              downloadImage(src, `${user.name || 'profile'}.jpg`);
                                                                                          }}
                                                                                      />
                                                                                      <button
                                                                                          type="button"
                                                                                          onClick={(e) => {
                                                                                              e.stopPropagation();
                                                                                              downloadImage(src, `${user.name || 'profile'}.jpg`);
                                                                                          }}
                                                                                          className="absolute right-0 bottom-0 m-1 rounded bg-white p-1 shadow"
                                                                                          aria-label="ダウンロード"
                                                                                      >
                                                                                          <Download className="h-4 w-4 text-gray-700" />
                                                                                      </button>
                                                                                  </div>
                                                                              </div>
                                                                          );
                                                                      })()
                                                                    : null}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {nextPageUrl && (
                            <div className="mt-6 text-center">
                                <Button onClick={loadMore} disabled={loading} variant="outline">
                                    {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    もっとみる
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
