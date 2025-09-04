import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import PushPin from '@mui/icons-material/PushPin';
import { Edit, Plus, Trash } from 'lucide-react';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: '掲示板・マニュアル', href: route('posts.index') }];

const SortableHeader = ({ children, sort_key, queryParams }: { children: React.ReactNode; sort_key: string; queryParams: any }) => {
    const currentSort = queryParams?.sort || 'created_at';
    const currentDirection = queryParams?.direction || 'desc';

    const isCurrentSort = currentSort === sort_key;
    const newDirection = isCurrentSort && currentDirection === 'asc' ? 'desc' : 'asc';

    return (
        <Link href={route('posts.index', { sort: sort_key, direction: newDirection })} preserveState preserveScroll>
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

export default function PostsIndex() {
    type QueryParams = Record<string, string | undefined> | {};
    const [posts, setPosts] = useState<unknown[]>([]);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<string | null>(null);
    const [activeAudience, setActiveAudience] = useState<string | null>(null);
    const [activeRole, setActiveRole] = useState<string | null>(null);
    const [mobileTag, setMobileTag] = useState<string | null>(null);
    const [mobileType, setMobileType] = useState<string | null>(null);
    const [mobileAudience, setMobileAudience] = useState<string | null>(null);
    const [queryParams, setQueryParams] = useState<QueryParams>({});
    const [activeTab, setActiveTab] = useState<'all' | 'pinned'>('all');
    // rolesList may be used to map role id to name; keep as unknown[] to avoid any
    const [_rolesList, setRolesList] = useState<unknown[]>([]);
    const page = usePage();
    const currentUserId = Number((page.props as any).auth?.user?.id) || null;

    const loadInitial = useCallback(
        async (options?: {
            tag?: string | null;
            type?: string | null;
            audience?: string | null;
            role?: string | null;
            sort?: string | null;
            direction?: string | null;
        }) => {
            setLoading(true);
            try {
                const base = '/api/posts';
                const params: string[] = [];
                if (options?.tag) params.push('tag=' + encodeURIComponent(options.tag));
                if (options?.type) params.push('type=' + encodeURIComponent(options.type));
                if (options?.audience) params.push('audience=' + encodeURIComponent(options.audience));
                if (options?.role) params.push('role=' + encodeURIComponent(options.role));
                if (options?.sort) params.push('sort=' + encodeURIComponent(options.sort));
                if (options?.direction) params.push('direction=' + encodeURIComponent(options.direction));
                const url = params.length > 0 ? base + '?' + params.join('&') : base;
                const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error('Failed to fetch');
                const payload = await res.json();
                const list = payload.data || payload;
                setPosts(list);
                // preserve query params for SortableHeader and pagination
                setQueryParams({
                    sort: options?.sort || new URLSearchParams(window.location.search).get('sort') || undefined,
                    direction: options?.direction || new URLSearchParams(window.location.search).get('direction') || undefined,
                });
                // debug: inspect posts shape and current user id
                console.debug('posts.index: loaded', { currentUserId, count: Array.isArray(list) ? list.length : null, sample: list[0] });
                setNextPageUrl(payload.next_page_url || null);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        },
        [currentUserId],
    );

    // Pin/unpin helpers
    const togglePin = async (postId: number, pinned: boolean) => {
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            if (!pinned) {
                // pin
                const res = await fetch(`/api/posts/${postId}/pin`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                });
                if (!res.ok) throw new Error('pin failed');
            } else {
                // unpin
                const res = await fetch(`/api/posts/${postId}/pin`, {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                });
                if (!res.ok) throw new Error('unpin failed');
            }
            // update local state
            setPosts((prev: any[]) => prev.map((p) => (p.id === postId ? { ...p, pinned_by_current_user: !p.pinned_by_current_user } : p)));
        } catch (e) {
            console.error(e);
            alert('ピン操作に失敗しました');
        }
    };

    // loadInitial is called once on mount
    useEffect(() => {
        // read optional query params from URL and load accordingly, including sort/direction
        const doLoad = () => {
            const params = new URLSearchParams(window.location.search);
            const t = params.get('tag');
            const ty = params.get('type');
            const a = params.get('audience');
            const r = params.get('role');
            const s = params.get('sort');
            const d = params.get('direction');
            if (t) setActiveTag(t);
            if (ty) setActiveType(ty);
            if (a) setActiveAudience(a);
            if (r) setActiveRole(r);
            // preserve sort/direction so headers render current state
            setQueryParams({ sort: s || undefined, direction: d || undefined });
            loadInitial({ tag: t, type: ty, audience: a, role: r, sort: s, direction: d });
            // initialize mobile filters from url params
            setMobileTag(t || null);
            setMobileType(ty || null);
            setMobileAudience(a || null);
        };

        // initial load
        doLoad();
        // also re-run when Inertia page URL changes (so header clicks update the list)
    }, [loadInitial, page.url]);

    // fetch all roles so we can show role name when ?role= is an id
    useEffect(() => {
        fetch('/api/roles', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => {
                const list: Array<{ id?: number; name?: string }> = (d || []) as any;
                setRolesList(list);
                // if URL has ?role= and it's numeric, map to name
                const params = new URLSearchParams(window.location.search);
                const rparam = params.get('role');
                if (rparam) {
                    if (/^\d+$/.test(rparam)) {
                        const found = list.find((it) => String(it.id) === rparam);
                        if (found && found.name) setActiveRole(found.name);
                    } else {
                        setActiveRole(rparam);
                    }
                }
            })
            .catch(() => {
                // ignore
            });
    }, []);

    // helpers to show friendly Japanese labels for query params
    const audienceLabel = (a?: string | null) => {
        if (!a) return '';
        if (a === 'all') return '全体公開';
        if (a === 'restricted') return '限定公開';
        return a;
    };

    const typeLabel = (t?: string | null) => {
        if (!t) return '';
        if (t === 'board') return '掲示板';
        if (t === 'manual') return 'マニュアル';
        return t;
    };

    // date formatter used by both table and mobile cards
    const formatDateTime = (iso: string | undefined) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1); // no leading zero
        const dd = String(d.getDate());
        const hh = String(d.getHours());
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${y}/${m}/${dd} ${hh}:${mi}`;
    };

    const loadMore = () => {
        if (!nextPageUrl) return;
        setLoading(true);
        fetch(nextPageUrl, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((payload) => {
                const newPosts = payload.data || [];
                setPosts((prev) => [...prev, ...newPosts]);
                setNextPageUrl(payload.next_page_url || null);
            })
            .catch((e) => console.error(e))
            .finally(() => setLoading(false));
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="掲示板・マニュアル" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="掲示板・マニュアル" description="掲示板の投稿一覧・作成" />
                </div>

                {activeTag && (
                    <div className="mb-4 rounded border-l-4 border-orange-300 bg-orange-50 p-4 text-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="mr-2 inline-block text-orange-700">タグ「{activeTag}」で絞り込み中。</span>
                                <Link href={route('posts.index')} className="text-orange-700 underline">
                                    タグ絞り込みを解除
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {activeType && (
                    <div className="mb-4 rounded border-l-4 border-blue-300 bg-blue-50 p-4 text-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="mr-2 inline-block text-blue-700">タイプ「{typeLabel(activeType)}」で絞り込み中。</span>
                                <Link href={route('posts.index')} className="text-blue-700 underline">
                                    タイプ絞り込みを解除
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {activeAudience && (
                    <div className="mb-4 rounded border-l-4 border-green-300 bg-green-50 p-4 text-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="mr-2 inline-block text-green-700">閲覧範囲「{audienceLabel(activeAudience)}」で絞り込み中。</span>
                                <Link href={route('posts.index')} className="text-green-700 underline">
                                    閲覧範囲絞り込みを解除
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {activeRole && (
                    <div className="mb-4 rounded border-l-4 border-indigo-300 bg-indigo-50 p-4 text-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="mr-2 inline-block text-indigo-700">ロール「{activeRole}」で絞り込み中。</span>
                                <Link href={route('posts.index')} className="text-indigo-700 underline">
                                    ロール絞り込みを解除
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>投稿一覧</CardTitle>
                        <Link href={route('posts.create')}>
                            <Button>
                                <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">新規投稿</span>
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div>
                            {/* Tabs: All / Pinned */}
                            <div className="mb-4 flex items-center gap-2">
                                <Button
                                    variant={activeTab === 'all' ? undefined : 'ghost'}
                                    onClick={() => setActiveTab('all')}
                                    aria-pressed={activeTab === 'all'}
                                >
                                    全体
                                </Button>
                                <Button
                                    variant={activeTab === 'pinned' ? undefined : 'ghost'}
                                    onClick={() => setActiveTab('pinned')}
                                    aria-pressed={activeTab === 'pinned'}
                                >
                                    ピン止め
                                </Button>
                            </div>

                            {/* Desktop/table view (hidden on small screens) */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <SortableHeader sort_key="title" queryParams={queryParams}>
                                                    タイトル
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="audience" queryParams={queryParams}>
                                                    閲覧範囲
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="type" queryParams={queryParams}>
                                                    投稿タイプ
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="tags" queryParams={queryParams}>
                                                    タグ
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="user" queryParams={queryParams}>
                                                    投稿者
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead>
                                                <SortableHeader sort_key="updated_at" queryParams={queryParams}>
                                                    最終更新日時
                                                </SortableHeader>
                                            </TableHead>
                                            <TableHead className="text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(activeTab === 'pinned' ? (posts as any[]).filter((p) => p.pinned_by_current_user) : (posts as any[])).map(
                                            (post: any) => {
                                                // ...existing code...

                                                const formatDateTime = (iso: string | undefined) => {
                                                    if (!iso) return '—';
                                                    const d = new Date(iso);
                                                    if (Number.isNaN(d.getTime())) return '—';
                                                    const y = d.getFullYear();
                                                    const m = String(d.getMonth() + 1); // no leading zero
                                                    const dd = String(d.getDate()); // no leading zero
                                                    const hh = String(d.getHours()); // no leading zero
                                                    const mi = String(d.getMinutes()).padStart(2, '0'); // minutes two-digit
                                                    return `${y}/${m}/${dd} ${hh}:${mi}`;
                                                };

                                                const onRowClick = () => {
                                                    window.location.href = route('posts.show', post.id) as unknown as string;
                                                };

                                                const onEdit = (e: MouseEvent) => {
                                                    e.stopPropagation();
                                                    window.location.href = route('posts.edit', post.id) as unknown as string;
                                                };

                                                const onDelete = async (e: MouseEvent) => {
                                                    e.stopPropagation();
                                                    if (!confirm('投稿を削除します。よろしいですか？')) return;
                                                    try {
                                                        const token =
                                                            document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                                        const res = await fetch(`/api/posts/${post.id}`, {
                                                            method: 'DELETE',
                                                            credentials: 'same-origin',
                                                            headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                                                        });
                                                        if (!res.ok) throw new Error('削除失敗');
                                                        setPosts((prev) => prev.filter((p) => p.id !== post.id));
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('削除に失敗しました');
                                                    }
                                                };

                                                const postOwnerId = post?.user?.id ?? post?.user_id ?? null;
                                                const isDraft = post.is_public === false || Number(post.is_public) === 0 || post.is_public === '0';
                                                const isOwnDraft = Boolean(
                                                    isDraft && postOwnerId && currentUserId && Number(postOwnerId) === currentUserId,
                                                );
                                                const roles = post.roles || post.role || [];
                                                const allowedUsers = post.allowedUsers || post.allowed_users || post.allowed_user || [];

                                                return (
                                                    <TableRow
                                                        key={post.id}
                                                        className={`cursor-pointer hover:bg-gray-50 ${isOwnDraft ? 'bg-gray-100' : ''}`}
                                                        onClick={onRowClick}
                                                    >
                                                        <TableCell className="font-medium">
                                                            {/* Determine if current user has a view record for this post */}
                                                            {(() => {
                                                                const views = post.views || post.viewers || post.post_views || [];
                                                                const isReadByMe =
                                                                    currentUserId && Array.isArray(views)
                                                                        ? views.some((v: any) => {
                                                                              const uid = v?.user?.id ?? v?.user_id ?? v?.id ?? v;
                                                                              return Number(uid) === Number(currentUserId);
                                                                          })
                                                                        : false;
                                                                return (
                                                                    <div className="flex flex-col">
                                                                        {isReadByMe ? (
                                                                            <div className="mb-1">
                                                                                <Badge className="bg-gray-100 text-gray-800">既読</Badge>
                                                                            </div>
                                                                        ) : null}
                                                                        <div className="flex min-w-0 items-center gap-2">
                                                                            {/* pin icon on the left */}
                                                                            {currentUserId ? (
                                                                                <button
                                                                                    onClick={(e: MouseEvent) => {
                                                                                        e.stopPropagation();
                                                                                        togglePin(post.id, Boolean(post.pinned_by_current_user));
                                                                                    }}
                                                                                    aria-label={
                                                                                        post.pinned_by_current_user ? 'ピンを外す' : 'ピンする'
                                                                                    }
                                                                                    className="flex items-center justify-center rounded p-0.5"
                                                                                >
                                                                                    <PushPin
                                                                                        className={`h-5 w-3 ${post.pinned_by_current_user ? 'text-yellow-500' : 'text-gray-400'}`}
                                                                                    />
                                                                                </button>
                                                                            ) : null}

                                                                            <Link
                                                                                href={route('posts.show', post.id)}
                                                                                onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                                className="max-w-[48ch] break-words whitespace-normal text-blue-600 hover:underline"
                                                                            >
                                                                                {post.title || '(無題)'}
                                                                            </Link>
                                                                            {/* show draft badge when post is not public and belongs to current user */}
                                                                            {(() => {
                                                                                const postOwnerId = post?.user?.id ?? post?.user_id ?? null;
                                                                                const isDraft =
                                                                                    post.is_public === false ||
                                                                                    Number(post.is_public) === 0 ||
                                                                                    post.is_public === '0';
                                                                                if (
                                                                                    isDraft &&
                                                                                    postOwnerId &&
                                                                                    currentUserId &&
                                                                                    Number(postOwnerId) === currentUserId
                                                                                ) {
                                                                                    return (
                                                                                        <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                                                                                            下書き
                                                                                        </span>
                                                                                    );
                                                                                }
                                                                                return null;
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </TableCell>
                                                        <TableCell>
                                                            {post.audience === 'all' ? (
                                                                <Link
                                                                    href={route('posts.index') + '?audience=all'}
                                                                    onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                    className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-green-200 hover:opacity-95 hover:shadow-sm"
                                                                >
                                                                    <Badge className="bg-green-100 text-green-800">全体公開</Badge>
                                                                </Link>
                                                            ) : post.audience === 'restricted' ? (
                                                                <div className="flex flex-col">
                                                                    <span>
                                                                        <Link
                                                                            href={route('posts.index') + '?audience=restricted'}
                                                                            onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                            className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-purple-200 hover:opacity-95 hover:shadow-sm"
                                                                        >
                                                                            <Badge className="bg-purple-100 text-purple-800">限定公開</Badge>
                                                                        </Link>
                                                                    </span>
                                                                    <span className="mt-1 flex flex-wrap gap-1">
                                                                        {/* If roles are specified, show role names; otherwise show allowed users */}
                                                                        <>
                                                                            {roles &&
                                                                                roles.length > 0 &&
                                                                                roles.map((r: { id?: number; name: string }) => (
                                                                                    <Link
                                                                                        key={r.id || r.name}
                                                                                        href={
                                                                                            route('posts.index') +
                                                                                            '?role=' +
                                                                                            encodeURIComponent(r.id || r.name)
                                                                                        }
                                                                                        className="cursor-pointer rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800 transition duration-150 hover:bg-gray-200"
                                                                                        onClick={(e: MouseEvent) => {
                                                                                            e.stopPropagation();
                                                                                        }}
                                                                                    >
                                                                                        {r.name}
                                                                                    </Link>
                                                                                ))}
                                                                            {allowedUsers && allowedUsers.length > 0 ? (
                                                                                <Badge className="ml-1 bg-amber-100 text-xs text-amber-800">
                                                                                    ユーザー指定あり
                                                                                </Badge>
                                                                            ) : null}
                                                                            {!(roles && roles.length > 0) &&
                                                                            !(allowedUsers && allowedUsers.length > 0) ? (
                                                                                <span className="text-sm text-gray-500">(対象未指定)</span>
                                                                            ) : null}
                                                                        </>
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <Badge variant="outline">—</Badge>
                                                            )}
                                                            {!post.is_public || post.is_public === false || post.is_public === '0' ? (
                                                                <span className="ml-2 text-xs text-yellow-700">(非公開)</span>
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell>
                                                            {post.type ? (
                                                                post.type === 'board' ? (
                                                                    <Link
                                                                        href={route('posts.index') + '?type=board'}
                                                                        onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                        className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-blue-200 hover:opacity-95 hover:shadow-sm"
                                                                    >
                                                                        <Badge className="bg-blue-100 text-blue-800">掲示板</Badge>
                                                                    </Link>
                                                                ) : post.type === 'manual' ? (
                                                                    <Link
                                                                        href={route('posts.index') + '?type=manual'}
                                                                        onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                        className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-sky-200 hover:opacity-95 hover:shadow-sm"
                                                                    >
                                                                        <Badge className="bg-sky-100 text-sky-800">マニュアル</Badge>
                                                                    </Link>
                                                                ) : (
                                                                    <Link
                                                                        href={route('posts.index') + '?type=' + encodeURIComponent(post.type)}
                                                                        onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                        className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-gray-300 hover:opacity-95 hover:shadow-sm"
                                                                    >
                                                                        <Badge variant="outline">{post.type}</Badge>
                                                                    </Link>
                                                                )
                                                            ) : (
                                                                <Badge variant="outline">—</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                                {(post.tags || []).map((t: { id?: number; name: string }) => (
                                                                    <Link
                                                                        key={t.id || t.name}
                                                                        href={route('posts.index') + '?tag=' + encodeURIComponent(t.name)}
                                                                        className="cursor-pointer rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800 transition duration-150 hover:bg-orange-200"
                                                                        onClick={(e: MouseEvent) => {
                                                                            e.stopPropagation();
                                                                        }}
                                                                    >
                                                                        {t.name}
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{post.user ? post.user.name : '—'}</TableCell>
                                                        <TableCell>{formatDateTime(post.updated_at)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="inline-flex items-center justify-end gap-2">
                                                                {postOwnerId && currentUserId && Number(postOwnerId) === currentUserId ? (
                                                                    <div className="inline-flex justify-end gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onEdit(e);
                                                                            }}
                                                                        >
                                                                            <Edit className="mr-2 h-4 w-4" /> 編集
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="destructive"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onDelete(e);
                                                                            }}
                                                                        >
                                                                            <Trash className="mr-2 h-4 w-4" /> 削除
                                                                        </Button>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            },
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile stacked card view (no horizontal scroll) */}
                            {/* Mobile filter controls */}
                            <div className="mb-3 block md:hidden">
                                <div className="flex flex-col gap-2 rounded border bg-white p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="タグで絞り込み"
                                            value={mobileTag || ''}
                                            onChange={(e) => setMobileTag(e.target.value || null)}
                                            className="min-w-0 flex-1 rounded border p-2 text-sm"
                                        />
                                        <select
                                            value={mobileType || ''}
                                            onChange={(e) => setMobileType(e.target.value || null)}
                                            className="w-full min-w-0 rounded border p-2 text-sm sm:w-auto"
                                        >
                                            <option value="">タイプ</option>
                                            <option value="board">掲示板</option>
                                            <option value="manual">マニュアル</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={mobileAudience || ''}
                                            onChange={(e) => setMobileAudience(e.target.value || null)}
                                            className="w-full min-w-0 rounded border p-2 text-sm sm:w-auto"
                                        >
                                            <option value="">閲覧範囲</option>
                                            <option value="all">全体公開</option>
                                            <option value="restricted">限定公開</option>
                                        </select>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                className="rounded bg-indigo-600 px-3 py-1 text-white"
                                                onClick={() => {
                                                    // apply mobile filters
                                                    const tag = mobileTag || undefined;
                                                    const ty = mobileType || undefined;
                                                    const aud = mobileAudience || undefined;
                                                    setActiveTag(tag || null);
                                                    setActiveType(ty || null);
                                                    setActiveAudience(aud || null);
                                                    loadInitial({ tag, type: ty, audience: aud });
                                                    // update URL params for consistency
                                                    const params = new URLSearchParams(window.location.search);
                                                    if (tag) params.set('tag', tag);
                                                    else params.delete('tag');
                                                    if (ty) params.set('type', ty);
                                                    else params.delete('type');
                                                    if (aud) params.set('audience', aud);
                                                    else params.delete('audience');
                                                    const newUrl = `${window.location.pathname}?${params.toString()}`;
                                                    window.history.replaceState({}, '', newUrl);
                                                }}
                                            >
                                                適用
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded border px-3 py-1"
                                                onClick={() => {
                                                    setMobileTag(null);
                                                    setMobileType(null);
                                                    setMobileAudience(null);
                                                    setActiveTag(null);
                                                    setActiveType(null);
                                                    setActiveAudience(null);
                                                    loadInitial({});
                                                    window.history.replaceState({}, '', window.location.pathname);
                                                }}
                                            >
                                                クリア
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 md:hidden">
                                {(activeTab === 'pinned' ? (posts as any[]).filter((p) => p.pinned_by_current_user) : (posts as any[])).map(
                                    (post: any) => {
                                        const postOwnerId = post?.user?.id ?? post?.user_id ?? null;
                                        const isDraft = post.is_public === false || Number(post.is_public) === 0 || post.is_public === '0';
                                        const isOwnDraft = Boolean(isDraft && postOwnerId && currentUserId && Number(postOwnerId) === currentUserId);
                                        const roles = post.roles || post.role || [];
                                        const allowedUsers = post.allowedUsers || post.allowed_users || post.allowed_user || [];

                                        return (
                                            <div
                                                key={post.id}
                                                className={`flex w-full flex-col gap-2 rounded border p-3 shadow-sm ${isDraft ? 'bg-gray-300' : 'bg-white'}`}
                                                onClick={() => (window.location.href = route('posts.show', post.id) as unknown as string)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="truncate text-sm font-medium">{post.title || '(無題)'}</h3>
                                                            {isDraft ? (
                                                                <span className="ml-1 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                                                                    下書き
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{post.user ? post.user.name : '—'}</span>
                                                            <span>·</span>
                                                            <span>{formatDateTime(post.updated_at)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-2 flex items-center gap-1">
                                                        {/* Icon-only actions on mobile */}
                                                        {currentUserId ? (
                                                            <button
                                                                onClick={(e: MouseEvent) => {
                                                                    e.stopPropagation();
                                                                    togglePin(post.id, Boolean(post.pinned_by_current_user));
                                                                }}
                                                                aria-label={post.pinned_by_current_user ? 'ピンを外す' : 'ピンする'}
                                                                className="rounded p-2"
                                                            >
                                                                <PushPin
                                                                    className={`h-4 w-4 ${post.pinned_by_current_user ? 'text-yellow-500' : 'text-gray-400'}`}
                                                                />
                                                            </button>
                                                        ) : null}

                                                        {postOwnerId && currentUserId && Number(postOwnerId) === currentUserId ? (
                                                            <>
                                                                <Link
                                                                    href={route('posts.edit', post.id)}
                                                                    onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                >
                                                                    <Button variant="outline" size="sm" className="p-2">
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                </Link>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="p-2"
                                                                    onClick={(e: MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        (async () => {
                                                                            if (!confirm('投稿を削除します。よろしいですか？')) return;
                                                                            try {
                                                                                const token =
                                                                                    document
                                                                                        .querySelector('meta[name="csrf-token"]')
                                                                                        ?.getAttribute('content') || '';
                                                                                const res = await fetch(`/api/posts/${post.id}`, {
                                                                                    method: 'DELETE',
                                                                                    credentials: 'same-origin',
                                                                                    headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                                                                                });
                                                                                if (res.ok)
                                                                                    setPosts((prev: any[]) => prev.filter((p) => p.id !== post.id));
                                                                                else alert('削除に失敗しました');
                                                                            } catch (err) {
                                                                                console.error(err);
                                                                                alert('削除に失敗しました');
                                                                            }
                                                                        })();
                                                                    }}
                                                                >
                                                                    <Trash className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    {post.audience === 'all' ? (
                                                        <Badge className="bg-green-100 text-green-800">全体公開</Badge>
                                                    ) : post.audience === 'restricted' ? (
                                                        <Badge className="bg-purple-100 text-purple-800">限定公開</Badge>
                                                    ) : (
                                                        <Badge variant="outline">—</Badge>
                                                    )}
                                                    {post.type ? (
                                                        post.type === 'board' ? (
                                                            <Badge className="bg-blue-100 text-blue-800">掲示板</Badge>
                                                        ) : post.type === 'manual' ? (
                                                            <Badge className="bg-sky-100 text-sky-800">マニュアル</Badge>
                                                        ) : (
                                                            <Badge variant="outline">{post.type}</Badge>
                                                        )
                                                    ) : null}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    {(post.tags || []).slice(0, 5).map((t: any) => (
                                                        <span
                                                            key={t.id || t.name}
                                                            className="inline-block rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800"
                                                        >
                                                            {t.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        </div>

                        {nextPageUrl && (
                            <div className="mt-6 text-center">
                                <Button onClick={loadMore} disabled={loading} variant="outline">
                                    {loading ? '読み込み中...' : 'もっとみる'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
