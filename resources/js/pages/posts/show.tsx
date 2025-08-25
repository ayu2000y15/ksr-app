import ImageModal from '@/components/posts/image-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
// Ensure the emoji-picker web component is registered at runtime by importing the module for its side-effects.
import 'emoji-picker-element';
import { Edit, Globe, Plus, Smile, Tag, Trash } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const breadcrumbs = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: '掲示板', href: route('posts.index') },
    { title: '投稿詳細', href: '' },
];

// Note: we avoid adding a JSX intrinsic for <emoji-picker> and instead create the
// web component programmatically at runtime. This prevents TSX/JSX typing errors
// and ensures the custom element is attached when the module runs.

export default function PostShow() {
    const { props } = usePage();
    const post = (props as any).post as any | null;
    const currentUserId = (props as any).auth?.user?.id;

    const [modalOpen, setModalOpen] = useState(false);
    const [modalStartIndex, setModalStartIndex] = useState(0);

    const postAttachments = useMemo((): { url: string; isImage: boolean; original_name?: string }[] => {
        const attachments = post?.attachments || [];
        return (attachments || []).map((a: { file_path?: string; url?: string; path?: string; src?: string; original_name?: string }) => {
            let url = a.file_path || a.url || a.path || a.src || '';
            if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                url = '/storage/' + url;
            }
            const isImage = typeof url === 'string' && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url);
            return { url, isImage, original_name: a.original_name };
        });
    }, [post?.attachments]);

    type Reaction = { id: number; emoji: string; user?: { id?: number; name?: string; email?: string } };
    const [reactions, setReactions] = useState<Reaction[]>(post?.reactions || []);
    // initialize viewers sorted by id (ascending)
    const [viewers, setViewers] = useState<{ id?: number; name?: string; email?: string }[]>(
        (post?.viewers || []).slice().sort((a: any, b: any) => (Number(a?.id || 0) - Number(b?.id || 0))),
    );
    const [showViewersMobile, setShowViewersMobile] = useState(false);
    const viewersRef = useRef<HTMLDivElement | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerToggleRef = useRef<HTMLDivElement | null>(null);
    const pickerContainerRef = useRef<HTMLDivElement | null>(null);

    const EmojiPicker = ({ onEmojiClick }: { onEmojiClick: (emoji: string) => void }) => {
        const hostRef = useRef<HTMLDivElement | null>(null);
        const pickerRef = useRef<HTMLElement | null>(null);

        useEffect(() => {
            const host = hostRef.current;
            if (!host) return;

            // Create the custom element programmatically so TypeScript doesn't need a JSX intrinsic.
            const pickerEl = document.createElement('emoji-picker') as HTMLElement & {
                addEventListener: (evt: string, handler: EventListenerOrEventListenerObject) => void;
                removeEventListener: (evt: string, handler: EventListenerOrEventListenerObject) => void;
            };
            pickerRef.current = pickerEl;

            const handler = (event: any) => {
                const unicode = event?.detail?.unicode;
                if (unicode) onEmojiClick(unicode);
            };

            pickerEl.addEventListener('emoji-click', handler as EventListener);
            host.appendChild(pickerEl);

            return () => {
                pickerEl.removeEventListener('emoji-click', handler as EventListener);
                if (host.contains(pickerEl)) host.removeChild(pickerEl);
                pickerRef.current = null;
            };
        }, [onEmojiClick]);

        return <div ref={hostRef} />;
    };

    useEffect(() => {
        const registerView = async () => {
            if (!post?.id) return;
            try {
                const cookie = (document.cookie || '').split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
                const xsrf = cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
                await fetch(`/api/posts/${post.id}/views`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
                });
                const res = await fetch(`/api/posts/${post.id}/views`, { credentials: 'include', headers: { Accept: 'application/json' } });
                if (res.ok) {
                    const payload = await res.json().catch(() => null);
                    const list = payload?.data ? payload.data : payload;
                    if (Array.isArray(list)) {
                        const mapped = list.map((v: any) => v.user || v);
                        mapped.sort((a: any, b: any) => Number(a?.id || 0) - Number(b?.id || 0));
                        setViewers(mapped);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        registerView();
    }, [post?.id]);

    useEffect(() => {
        const loadReactions = async () => {
            if (!post?.id) return;
            try {
                const res = await fetch(`/api/posts/${post.id}/reactions`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                });
                if (res.ok) {
                    const payload = await res.json().catch(() => null);
                    const list = payload?.data ? payload.data : payload;
                    if (Array.isArray(list)) setReactions(list as Reaction[]);
                }
            } catch (e) {
                console.error(e);
            }
        };
        loadReactions();
    }, [post?.id]);

    // Close mobile viewers popup when tapping outside
    useEffect(() => {
        if (!showViewersMobile) return;
        const onDocClick = (ev: MouseEvent) => {
            if (!viewersRef.current) return;
            if (!viewersRef.current.contains(ev.target as Node)) {
                setShowViewersMobile(false);
            }
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [showViewersMobile]);

    const toggleReaction = useCallback(
        async (emoji: string) => {
            if (!post?.id) return;
            try {
                const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                const res = await fetch(`/api/posts/${post.id}/reactions`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'X-CSRF-TOKEN': token,
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ emoji }),
                });
                if (res.ok) {
                    const payload = await res.json().catch(() => null);
                    const list = payload?.data ? payload.data : payload;
                    if (Array.isArray(list)) setReactions(list as Reaction[]);
                }
            } catch (e) {
                console.error(e);
            }
        },
        [post?.id],
    );

    useEffect(() => {
        const pickerDiv = pickerContainerRef.current;
        const toggleButton = pickerToggleRef.current;

        if (!pickerDiv || !toggleButton) return;

        if (pickerOpen) {
            const rect = toggleButton.getBoundingClientRect();
            pickerDiv.style.top = `${rect.bottom + window.scrollY + 6}px`;
            pickerDiv.style.left = `${rect.left + window.scrollX}px`;
            pickerDiv.style.display = 'block';

            const onDocClick = (ev: MouseEvent) => {
                if (!pickerDiv.contains(ev.target as Node) && !toggleButton.contains(ev.target as Node)) {
                    setPickerOpen(false);
                }
            };
            document.addEventListener('click', onDocClick, true);

            return () => {
                document.removeEventListener('click', onDocClick, true);
            };
        } else {
            pickerDiv.style.display = 'none';
        }
    }, [pickerOpen]);

    const reactionMap = (() => {
        const map: Record<string, { users: Array<{ id?: number; name?: string; email?: string }>; count: number; reactedByMe: boolean }> = {};
        (reactions || []).forEach((r) => {
            if (!map[r.emoji]) map[r.emoji] = { users: [], count: 0, reactedByMe: false };
            map[r.emoji].count++;
            if (r.user) map[r.emoji].users.push(r.user);
            if (r.user?.id === currentUserId) map[r.emoji].reactedByMe = true;
        });
        // sort each emoji's users by id ascending
        Object.keys(map).forEach((k) => {
            map[k].users.sort((a: any, b: any) => Number(a?.id || 0) - Number(b?.id || 0));
        });
        return map;
    })();

    const [activeReaction, setActiveReaction] = useState<string | null>(null);
    const reactionPopupRef = useRef<HTMLDivElement | null>(null);

    const userHasReacted = useMemo(() => {
        return reactions.some((r) => r.user?.id === currentUserId);
    }, [reactions, currentUserId]);

    // close reaction popup when tapping outside (useful for mobile)
    useEffect(() => {
        if (!activeReaction) return;
        const onDocClick = (ev: MouseEvent) => {
            if (!reactionPopupRef.current) return;
            if (!reactionPopupRef.current.contains(ev.target as Node)) {
                setActiveReaction(null);
            }
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [activeReaction]);

    const tagNodes = (post?.tags || []).map((t: { id?: number; name: string }) => (
        <Link key={t.id || t.name} href={route('posts.index') + '?tag=' + encodeURIComponent(t.name)}>
            <Badge variant="outline" className="cursor-pointer border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200">
                <Tag className="mr-1.5 h-3.5 w-3.5" />
                {t.name}
            </Badge>
        </Link>
    ));

    const roleNodes = (post?.roles || []).map((r: { id?: number; name: string }) => (
        <Badge key={r.id || r.name} variant="outline" className="border-violet-300 bg-violet-50 text-violet-700">
            {r.name}
        </Badge>
    ));

    const allowedUsers = (post?.allowedUsers || post?.allowed_users || []) as Array<{ id?: number; name?: string; email?: string }>;
    const allowedUserNodes = allowedUsers.map((u) => (
        <Badge key={u.id || u.email || u.name} variant="outline" className="border-gray-200 bg-gray-50 text-gray-800">
            {u.name || u.email || '匿名'}
        </Badge>
    ));

    async function handleDelete() {
        if (!post) return;
        if (!confirm('この投稿を削除しますか？この操作は元に戻せません。')) return;
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(`/api/posts/${post.id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'X-CSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
            });
            if (res.ok) window.location.href = route('posts.index');
            else alert('削除に失敗しました: ' + (await res.text()).slice(0, 200));
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={post?.title || '投稿'} />
            <style>{`
                .post-body .hashtag{display:inline-block; background:#fff7ed; color:#c2410c; padding:2px 6px; border-radius:9999px; font-size:0.9em; margin:0 2px}
                .post-body .mention{display:inline-block; background:#eff6ff; color:#1e40af; padding:2px 6px; border-radius:9999px; font-size:0.9em; margin:0 2px}
                .post-body em, .post-body i {font-style: italic; color: #0f172a; background: #f8fafc; padding: 0 3px; border-radius: 3px}
                .post-body table{width:100%; border-collapse:collapse; margin:8px 0}
                .post-body th, .post-body td{border:1px solid #d1d5db; padding:8px; text-align:left}
                .post-body h1{font-size:20px}
                .post-body h2{font-size:18px}
                .post-body h3{font-size:16px}
                .post-body h4{font-size:15px}
                .post-body ul{padding-left:1.25rem}
                .post-body {
                    line-height: 1.7;
                }
                .post-body p,
                .post-body h1,
                .post-body h2,
                .post-body h3,
                .post-body h4,
                .post-body ul,
                .post-body ol,
                .post-body blockquote,
                .post-body pre {
                    margin-top: 0;
                    margin-bottom: 0.9rem;
                }
                .post-body ul > li,
                .post-body ol > li {
                    margin-bottom: 0.45rem;
                }
                .post-body p + p,
                .post-body p + h2,
                .post-body h2 + p,
                .post-body h3 + p {
                    margin-top: 0.9rem;
                }
            `}</style>
            <div className="py-12">
                <div className="mx-auto max-w-5xl sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader className="border-b bg-gray-50 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                    <div className="min-w-0 flex-shrink-0">
                                        <h1 className="truncate text-xl font-bold sm:text-2xl">{post?.title || '(無題)'}</h1>
                                        <div className="mt-1 truncate text-sm text-muted-foreground">
                                            <span>{post?.user?.name || '—'}</span>
                                            <span className="mx-1.5">·</span>
                                            <span>{post?.updated_at ? new Date(post.updated_at).toLocaleString() : '—'}</span>
                                        </div>
                                    </div>
                                    <div className="hidden h-10 self-center border-l border-gray-200 sm:block"></div>
                                    <div>
                                        <div className="mb-1 text-xs text-muted-foreground">閲覧範囲</div>
                                        {post?.audience === 'all' ? (
                                            <Badge className="border-green-300 bg-green-50 text-green-700">
                                                <Globe className="mr-1.5 h-3.5 w-3.5" />
                                                全体公開
                                            </Badge>
                                        ) : post?.audience === 'restricted' ? (
                                            <div className="space-y-2">
                                                <Badge className="border-violet-300 bg-violet-50 text-violet-700">
                                                    <Globe className="mr-1.5 h-3.5 w-3.5" />
                                                    限定公開
                                                </Badge>
                                                {roleNodes && roleNodes.length > 0 && (
                                                    <div>
                                                        <div className="mb-1 text-xs text-muted-foreground">対象ロール</div>
                                                        <div className="flex flex-wrap items-center gap-2">{roleNodes}</div>
                                                    </div>
                                                )}
                                                {allowedUserNodes && allowedUserNodes.length > 0 && (
                                                    <div>
                                                        <div className="mb-1 text-xs text-muted-foreground">閲覧対象ユーザー</div>
                                                        <div className="flex flex-wrap items-center gap-2">{allowedUserNodes}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                    {tagNodes.length > 0 && (
                                        <>
                                            <div className="hidden h-10 self-center border-l border-gray-200 sm:block"></div>
                                            <div>
                                                <div className="mb-1 text-xs text-muted-foreground">タグ</div>
                                                <div className="flex flex-wrap items-center gap-2">{tagNodes}</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {post?.user && currentUserId && currentUserId === post.user.id ? (
                                    <div className="flex flex-shrink-0 items-center gap-2">
                                        <Link href={post ? route('posts.edit', post.id) : '#'}>
                                            <Button variant="outline">
                                                <Edit className="mr-2 h-4 w-4" /> 編集
                                            </Button>
                                        </Link>
                                        <Button size="sm" variant="destructive" onClick={handleDelete}>
                                            <Trash className="mr-2 h-4 w-4" /> 削除
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="prose dark:prose-invert max-w-none">
                                <div className="post-body" dangerouslySetInnerHTML={{ __html: post?.body || '' }} />
                            </div>
                            {postAttachments.length > 0 && (
                                <div>
                                    <div className="mt-3 flex items-start gap-3">
                                        {postAttachments.map((p, idx) => (
                                            <div key={p.url || idx} className="relative h-20 w-20 overflow-hidden rounded bg-gray-50">
                                                {p.isImage ? (
                                                    <img
                                                        src={p.url}
                                                        alt={`attachment ${idx + 1}`}
                                                        className="h-full w-full cursor-pointer object-cover"
                                                        onClick={() => {
                                                            setModalStartIndex(idx);
                                                            setModalOpen(true);
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center p-2 text-xs">
                                                        {p.original_name || p.url.split('/').pop()}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {!userHasReacted && (
                                        <div ref={pickerToggleRef}>
                                            <button
                                                type="button"
                                                className="inline-flex h-8 min-w-[44px] items-center gap-1 rounded-md border bg-white px-3 text-sm leading-none"
                                                onClick={() => setPickerOpen((s) => !s)}
                                            >
                                                <Plus className="h-4 w-4" />
                                                <Smile className="h-4 w-4 text-black" aria-hidden />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        {Object.entries(reactionMap).map(([emoji, m]) => {
                                            const meta = m as {
                                                users: Array<{ id?: number; name?: string; email?: string }>;
                                                count: number;
                                                reactedByMe: boolean;
                                            };
                                            return (
                                                <div key={emoji} className="relative inline-flex items-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleReaction(emoji)}
                                                        onMouseEnter={() => setActiveReaction(emoji)}
                                                        onMouseLeave={() => setActiveReaction(null)}
                                                        className={`inline-flex h-8 min-w-[44px] items-center gap-1 rounded-md border px-3 text-sm leading-none ${meta.reactedByMe ? 'border-blue-200 bg-blue-50' : 'bg-white'}`}
                                                    >
                                                        <span className="inline-flex items-center justify-center text-base leading-none">
                                                            {emoji}
                                                        </span>
                                                        <span className="ml-1 text-xs leading-none text-gray-600">{meta.count}</span>
                                                    </button>

                                                    {activeReaction === emoji && (
                                                        <div
                                                            ref={reactionPopupRef}
                                                            className="absolute top-full left-0 z-20 mt-1 w-56 rounded border bg-white p-2 text-xs shadow"
                                                        >
                                                            {meta.users && meta.users.length > 0 ? (
                                                                <ul className="max-h-40 space-y-1 overflow-auto">
                                                                    {meta.users.map((u: { id?: number; name?: string; email?: string }) => (
                                                                        <li key={u.id || u.email || u.name} className="truncate">
                                                                            {u.name || u.email || '匿名'}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="text-xs text-gray-500">まだ誰もリアクションしていません</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600">
                                    {/* Desktop: hover to show (existing behavior) */}
                                    <div className="hidden md:inline-block">
                                        <div className="group relative inline-block">
                                            <span className="cursor-default">既読: {viewers ? viewers.length : 0} 人</span>
                                            <div className="pointer-events-none absolute top-full right-0 z-10 mt-1 hidden w-60 rounded border bg-white p-2 text-left text-xs shadow group-hover:block">
                                                {viewers && viewers.length > 0 ? (
                                                    <ul className="max-h-40 space-y-1 overflow-auto">
                                                        {viewers.map((v) => (
                                                            <li key={v.id} className="truncate">
                                                                {v.name || v.email || '匿名'}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="text-xs text-gray-500">まだ閲覧者はいません</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile: tap to toggle viewers list; tapping outside closes it */}
                                    <div className="md:hidden">
                                        <div className="relative inline-block" ref={viewersRef}>
                                            <button type="button" className="cursor-pointer" onClick={() => setShowViewersMobile((s) => !s)}>
                                                既読: {viewers ? viewers.length : 0} 人
                                            </button>
                                            {showViewersMobile && (
                                                <div className="absolute top-full right-0 z-10 mt-1 w-60 rounded border bg-white p-2 text-left text-xs shadow">
                                                    {viewers && viewers.length > 0 ? (
                                                        <ul className="max-h-40 space-y-1 overflow-auto">
                                                            {viewers.map((v) => (
                                                                <li key={v.id} className="truncate">
                                                                    {v.name || v.email || '匿名'}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <div className="text-xs text-gray-500">まだ閲覧者はいません</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            {modalOpen && (
                <ImageModal
                    images={postAttachments.filter((p) => p.isImage).map((p) => p.url)}
                    startIndex={modalStartIndex}
                    onClose={() => setModalOpen(false)}
                />
            )}

            {createPortal(
                <div ref={pickerContainerRef} style={{ position: 'absolute', display: 'none', zIndex: 9999 }} className="rounded-lg shadow-xl">
                    {pickerOpen && (
                        <EmojiPicker
                            onEmojiClick={(emoji) => {
                                toggleReaction(emoji);
                                setPickerOpen(false);
                            }}
                        />
                    )}
                </div>,
                document.body,
            )}
        </AppSidebarLayout>
    );
}
