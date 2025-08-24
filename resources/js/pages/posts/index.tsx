import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Edit, Plus, Trash } from 'lucide-react';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: '掲示板', href: route('posts.index') },
];

export default function PostsIndex() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [posts, setPosts] = useState<any[]>([]);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<string | null>(null);
    const [activeAudience, setActiveAudience] = useState<string | null>(null);
    const [activeRole, setActiveRole] = useState<string | null>(null);
    const [rolesList, setRolesList] = useState<any[]>([]);
    const page = usePage();
    const currentUserId = Number((page.props as any).auth?.user?.id) || null;

    const loadInitial = useCallback(
        async (filters?: { tag?: string | null; type?: string | null; audience?: string | null; role?: string | null }) => {
            setLoading(true);
            try {
                const base = '/api/posts';
                const params: string[] = [];
                if (filters?.tag) params.push('tag=' + encodeURIComponent(filters.tag));
                if (filters?.type) params.push('type=' + encodeURIComponent(filters.type));
                if (filters?.audience) params.push('audience=' + encodeURIComponent(filters.audience));
                if (filters?.role) params.push('role=' + encodeURIComponent(filters.role));
                const url = params.length > 0 ? base + '?' + params.join('&') : base;
                const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error('Failed to fetch');
                const payload = await res.json();
                const list = payload.data || payload;
                setPosts(list);
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

    // loadInitial is called once on mount
    useEffect(() => {
        // read optional ?tag= from URL and load accordingly
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tag');
        const ty = params.get('type');
        const a = params.get('audience');
        const r = params.get('role');
        if (t) setActiveTag(t);
        if (ty) setActiveType(ty);
        if (a) setActiveAudience(a);
        if (r) setActiveRole(r);
        loadInitial({ tag: t, type: ty, audience: a, role: r });
    }, [loadInitial]);

    // fetch all roles so we can show role name when ?role= is an id
    useEffect(() => {
        fetch('/api/roles', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => {
                const list = d || [];
                setRolesList(list);
                // if URL has ?role= and it's numeric, map to name
                const params = new URLSearchParams(window.location.search);
                const rparam = params.get('role');
                if (rparam) {
                    if (/^\d+$/.test(rparam)) {
                        const found = list.find((it: any) => String(it.id) === rparam);
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
            <Head title="掲示板" />

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <HeadingSmall title="掲示板" description="掲示板の投稿一覧・作成を行います。" />
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
                                <span className="mr-2 inline-block text-blue-700">タイプ「{activeType}」で絞り込み中。</span>
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
                                <span className="mr-2 inline-block text-green-700">閲覧範囲「{activeAudience}」で絞り込み中。</span>
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
                    <CardHeader className="flex flex-row items-center justify-between">
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>タイトル</TableHead>
                                        <TableHead>閲覧範囲</TableHead>
                                        <TableHead>投稿タイプ</TableHead>
                                        <TableHead>タグ</TableHead>
                                        <TableHead>投稿者</TableHead>
                                        <TableHead>最終更新日時</TableHead>
                                        <TableHead className="text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {posts.map((post: any) => {
                                        // ...existing code...

                                        const formatDateTime = (iso: string | undefined) => {
                                            if (!iso) return '—';
                                            const d = new Date(iso);
                                            if (Number.isNaN(d.getTime())) return '—';
                                            const y = d.getFullYear();
                                            const m = String(d.getMonth() + 1).padStart(2, '0');
                                            const dd = String(d.getDate()).padStart(2, '0');
                                            const hh = String(d.getHours()).padStart(2, '0');
                                            const mi = String(d.getMinutes()).padStart(2, '0');
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
                                                const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
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
                                        const isOwnDraft = Boolean(isDraft && postOwnerId && currentUserId && Number(postOwnerId) === currentUserId);
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
                                                                <div className="flex items-center gap-2">
                                                                    <Link
                                                                        href={route('posts.show', post.id)}
                                                                        onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                        className="text-blue-600 hover:underline"
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
                                                                    {!(roles && roles.length > 0) && !(allowedUsers && allowedUsers.length > 0) ? (
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
                                                                className="inline-flex transform cursor-pointer items-center rounded transition duration-150 hover:bg-gray-200 hover:opacity-95 hover:shadow-sm"
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
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
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
