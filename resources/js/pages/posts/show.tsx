import ImageModal from '@/components/posts/image-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
// Ensure the emoji-picker web component is registered at runtime by importing the module for its side-effects.
import 'emoji-picker-element';
import { Edit, Globe, Plus, Printer, Smile, Tag, Trash } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const breadcrumbs = [
    { title: '掲示板', href: route('posts.index') },
    { title: '投稿詳細', href: '' },
];

// Note: we avoid adding a JSX intrinsic for <emoji-picker> and instead create the
// web component programmatically at runtime. This prevents TSX/JSX typing errors
// and ensures the custom element is attached when the module runs.

export default function PostShow() {
    const { props } = usePage();
    const post = (props as any).post as any | null;
    // determine if a post is a draft - support several possible backend shapes
    const isDraft = (p: any) => {
        if (!p) return false;
        // explicit status
        if (typeof p.status === 'string' && p.status.toLowerCase() === 'draft') return true;
        // common boolean/number flags (1, '1', true, 'true')
        const truthy = (v: any) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
        if (truthy(p.is_draft) || truthy(p.draft)) return true;
        // published flags: published === false / 0 / '0' means draft
        const falsy = (v: any) => v === false || v === 0 || v === '0' || (typeof v === 'string' && v.toLowerCase() === 'false');
        if (falsy(p.published)) return true;
        // post table: is_public === 0 means draft
        if ('is_public' in p && Number(p.is_public) === 0) return true;
        // if published_at is present and truthy it's published; if absent or null -> treat as draft
        if ('published_at' in p && (p.published_at === null || p.published_at === undefined || p.published_at === '')) return true;
        return false;
    };
    const currentUserId = (props as any).auth?.user?.id;

    const [modalOpen, setModalOpen] = useState(false);
    const [modalStartIndex, setModalStartIndex] = useState(0);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [manualModalImages, setManualModalImages] = useState<string[]>([]);
    const [manualModalStartIndex, setManualModalStartIndex] = useState(0);
    // printing will use a hidden iframe appended to the document

    const postAttachments = useMemo((): { url: string; isImage: boolean; original_name?: string; size?: number }[] => {
        const attachments = post?.attachments || [];
        return (attachments || []).map(
            (a: {
                file_path?: string;
                url?: string;
                path?: string;
                src?: string;
                original_name?: string;
                size?: number;
                file_size?: number;
                byte_size?: number;
                filesize?: number;
            }) => {
                let url = a.file_path || a.url || a.path || a.src || '';
                if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                    url = '/storage/' + url;
                }
                const isImage = typeof url === 'string' && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url);
                const size = (a as any).size || (a as any).file_size || (a as any).byte_size || (a as any).filesize || undefined;
                return { url, isImage, original_name: a.original_name, size };
            },
        );
    }, [post?.attachments]);

    const manualItems = useMemo(() => {
        const items = Array.isArray(post?.items)
            ? post.items.slice()
            : Array.isArray(post?.post_items)
              ? post.post_items.slice()
              : Array.isArray(post?.postItems)
                ? post.postItems.slice()
                : [];
        // sort by explicit order if present, otherwise keep server order
        items.sort((a: any, b: any) => {
            const oa = Number(a?.order || a?.sort || 0);
            const ob = Number(b?.order || b?.sort || 0);
            if (oa && ob) return oa - ob;
            // fall back to id if order not present
            return Number(a?.id || 0) - Number(b?.id || 0);
        });

        return items.map((it: any) => {
            const attachments = Array.isArray(it.attachments) ? it.attachments : [];
            const imgs = attachments.map((a: any) => {
                let url = a.file_path || a.url || a.path || a.src || '';
                if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                    url = '/storage/' + url;
                }
                const isImage = typeof url === 'string' && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url);
                const size = a?.size || a?.file_size || a?.byte_size || a?.filesize || undefined;
                return { url, isImage, original_name: a.original_name, size };
            });
            const content = it.content || it.text || it.description || it.body || '';
            return {
                id: it.id,
                content,
                attachments: imgs,
            };
        });
    }, [post?.items, post?.post_items, post?.postItems]);

    type Reaction = { id: number; emoji: string; user?: { id?: number; name?: string; email?: string } };
    const [reactions, setReactions] = useState<Reaction[]>(post?.reactions || []);
    // initialize viewers sorted by id (ascending)
    const [viewers, setViewers] = useState<{ id?: number; name?: string; email?: string }[]>(
        (post?.viewers || []).slice().sort((a: any, b: any) => Number(a?.id || 0) - Number(b?.id || 0)),
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

    function escapeHtml(unsafe: string) {
        return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function formatTextToParagraphs(txt: string) {
        // normalize newlines
        const normalized = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // split into paragraphs at two or more newlines
        const paras = normalized
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        return paras
            .map((p) => `<p style="margin:0 0 12px; text-align:left; white-space:pre-wrap;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
            .join('');
    }

    function formatBytes(bytes?: number) {
        if (bytes === undefined || bytes === null) return '';
        if (bytes < 1024) return bytes + ' B';
        const kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(kb < 10 ? 2 : 1) + ' KB';
        const mb = kb / 1024;
        return mb.toFixed(2) + ' MB';
    }

    function handlePrint() {
        if (!post) return;
        const title = post.title || '(無題)';
        const appName = (import.meta as unknown as { env?: { VITE_APP_NAME?: string } })?.env?.VITE_APP_NAME || post?.app_name || '';

        const styles = `@page{margin:20mm 15mm} @page :first{margin-top:8mm} body{font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#0f172a; padding:20px} .post-title{font-size:20px;font-weight:700;margin-bottom:6px} .meta{color:#475569;font-size:13px;margin-bottom:12px} .manual-item{border:1px solid #e5e7eb;padding:12px;margin-bottom:12px;border-radius:6px} .badge{display:inline-block;width:28px;height:28px;border-radius:14px;background:#fef3c7;color:#92400e;text-align:center;line-height:28px;font-weight:600;margin-right:8px} .attachments{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start} img.print-img{box-sizing:border-box;width:calc(50% - 8px);height:auto;object-fit:contain;border:1px solid #000;padding:2px;background:#fff} /* single image: limit printed size and center */ .attachments.single img.print-img{width:auto;max-width:100%;max-height:160mm;display:block;margin-left:auto;margin-right:auto} /* avoid breaking manual-item across pages */ .manual-item{page-break-inside:avoid;break-inside:avoid;-webkit-column-break-inside:avoid} .manual-item .attachments{page-break-inside:avoid;break-inside:avoid} .manual-item img.print-img{page-break-inside:avoid;break-inside:avoid} .print-footer{position:fixed;left:20px;bottom:12px;font-size:12px;color:#475569} @media print{ /* ensure attachments sizing */ .attachments{gap:8px} .attachments.single img.print-img{width:auto;max-width:100%;max-height:160mm;display:block;margin-left:auto;margin-right:auto} img.print-img{width:calc(50% - 8px)} .print-footer{position:fixed;left:20px;bottom:12px} }`;

        let bodyHtml = `<div class="print-header" style="position:relative;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">`;
        bodyHtml += `<div class="post-title">${escapeHtml(title)}</div>`;
        bodyHtml += `<div class="meta">作成者: ${escapeHtml(post.user?.name || '')}</div>`;
        bodyHtml += `<div class="print-appname" style="position:absolute;left:0;bottom:0;font-size:12px;color:#475569">${escapeHtml(appName)}</div>`;
        bodyHtml += `</div>`;

        if (post.type === 'manual') {
            (manualItems || []).forEach(
                (
                    it: { id?: number | string; content?: string; attachments?: Array<{ isImage?: boolean; url?: string; original_name?: string }> },
                    idx: number,
                ) => {
                    // get plain text from HTML content
                    let txt = '';
                    try {
                        const tmp = document.createElement('div');
                        tmp.innerHTML = it.content || '';
                        txt = tmp.textContent || tmp.innerText || '';
                    } catch {
                        txt = it.content || '';
                    }

                    const paraHtml = formatTextToParagraphs(txt);
                    bodyHtml += `<div class="manual-item"><div><span class="badge">${idx + 1}</span><div style="display:inline-block;vertical-align:top;max-width:calc(100% - 40px)">${paraHtml}</div></div>`;
                    if (it.attachments && it.attachments.length > 0) {
                        const singleClass = it.attachments.length === 1 ? ' attachments single' : ' attachments';
                        bodyHtml += `<div class="${singleClass}">`;
                        it.attachments.forEach((a: { isImage?: boolean; url?: string; original_name?: string }) => {
                            if (a.isImage && a.url) {
                                bodyHtml += `<img class="print-img" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.original_name || '')}" />`;
                            } else if (a.url) {
                                bodyHtml += `<div>${escapeHtml(a.original_name || a.url.split('/').pop() || '')}</div>`;
                            }
                        });
                        bodyHtml += `</div>`;
                    }
                    bodyHtml += `</div>`;
                },
            );
        } else {
            // board: include HTML body as-is
            // ensure body paragraphs align by wrapping content in a container
            bodyHtml += `<div class="post-body-print">${post.body || ''}</div>`;
            if (postAttachments && postAttachments.length > 0) {
                const singleClass = postAttachments.length === 1 ? ' attachments single' : ' attachments';
                bodyHtml += `<div class="${singleClass}">`;
                postAttachments.forEach((p) => {
                    if (p.isImage && p.url)
                        bodyHtml += `<img class="print-img" src="${escapeHtml(p.url)}" alt="${escapeHtml(p.original_name || '')}" />`;
                    else if (p.url) bodyHtml += `<div>${escapeHtml(p.original_name || p.url.split('/').pop() || '')}</div>`;
                });
                bodyHtml += `</div>`;
            }
        }

        // footer removed to avoid duplicating app name (app name is shown in header left-bottom)
        const waitScript = `<script>(function(){
            try{
                const imgs = Array.from(document.images || []);
                const prom = imgs.map(img => new Promise((res) => {
                    if (img.complete) return res();
                    img.addEventListener('load', res);
                    img.addEventListener('error', res);
                }));
                Promise.all(prom).then(() => {
                    setTimeout(function(){ try{ window.focus(); window.print(); }catch(e){} }, 50);
                });
            }catch(e){ try{ window.focus(); window.print(); }catch(e){} }
        })();</script>`;

        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${styles} .badge{vertical-align:top;}</style></head><body>${bodyHtml}${waitScript}</body></html>`;

        // create a hidden iframe and set srcdoc so printing happens without opening a new tab or modal
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        iframe.srcdoc = html;
        const cleanup = () => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
        };
        iframe.onload = () => {
            // iframe contains script that waits for images and calls print(); we just cleanup after a delay
            setTimeout(cleanup, 2000);
        };
        document.body.appendChild(iframe);
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
                                        <div className="flex items-center gap-2">
                                            <h1 className="truncate text-xl font-bold sm:text-2xl">{post?.title || '(無題)'}</h1>
                                            {isDraft(post) && <Badge className="border-yellow-300 bg-yellow-50 text-yellow-800">下書き</Badge>}
                                        </div>
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
                                <div className="flex flex-shrink-0 items-center gap-2">
                                    <Button variant="outline" onClick={handlePrint}>
                                        <Printer className="mr-2 h-4 w-4" /> 印刷
                                    </Button>
                                    {post?.user && currentUserId && currentUserId === post.user.id && (
                                        <>
                                            <Link href={post ? route('posts.edit', post.id) : '#'}>
                                                <Button variant="outline">
                                                    <Edit className="mr-2 h-4 w-4" /> 編集
                                                </Button>
                                            </Link>
                                            <Button size="sm" variant="destructive" onClick={handleDelete}>
                                                <Trash className="mr-2 h-4 w-4" /> 削除
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="prose dark:prose-invert max-w-none">
                                <div className="post-body" dangerouslySetInnerHTML={{ __html: post?.body || '' }} />
                            </div>
                            {post?.type === 'manual' ? (
                                <div className="space-y-6">
                                    {manualItems.map(
                                        (
                                            it: {
                                                id?: number | string;
                                                content?: string;
                                                attachments?: Array<{ url?: string; isImage?: boolean; original_name?: string }>;
                                            },
                                            i: number,
                                        ) => (
                                            <div key={it.id || i} className="rounded border p-4">
                                                <div className="mb-3 flex items-start gap-3">
                                                    <div className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center self-start rounded-full bg-yellow-100 font-semibold text-yellow-800">
                                                        {i + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm break-words whitespace-pre-wrap text-gray-600">
                                                            {(() => {
                                                                try {
                                                                    const tmp = document.createElement('div');
                                                                    tmp.innerHTML = it.content || '';
                                                                    const txt = tmp.textContent || tmp.innerText || '';
                                                                    return txt;
                                                                } catch {
                                                                    return '';
                                                                }
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                                {Array.isArray(it.attachments) && it.attachments.length > 0 && (
                                                    <div className={`mt-3 grid ${it.attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                                                        {it.attachments.map(
                                                            (a: { url?: string; isImage?: boolean; original_name?: string }, ai: number) => (
                                                                <div
                                                                    key={a.url || ai}
                                                                    className="overflow-hidden rounded bg-gray-50"
                                                                    style={{ height: it.attachments && it.attachments.length === 1 ? 360 : 200 }}
                                                                >
                                                                    {a.isImage ? (
                                                                        <img
                                                                            src={a.url}
                                                                            alt={a.original_name || `item-${i}-img-${ai}`}
                                                                            className="h-full w-full cursor-pointer object-contain"
                                                                            onClick={() => {
                                                                                const imgs = (it.attachments || [])
                                                                                    .filter(
                                                                                        (x: { isImage?: boolean; url?: string }) =>
                                                                                            x.isImage && !!x.url,
                                                                                    )
                                                                                    .map((x: { isImage?: boolean; url?: string }) => x.url as string);
                                                                                setManualModalImages(imgs);
                                                                                const idx = imgs.findIndex((u: string) => u === (a.url || ''));
                                                                                setManualModalStartIndex(idx >= 0 ? idx : 0);
                                                                                setManualModalOpen(true);
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <div className="flex h-full w-full flex-col items-start justify-center p-2 text-xs">
                                                                            {a.url ? (
                                                                                <a
                                                                                    href={a.url}
                                                                                    download={a.original_name || undefined}
                                                                                    className="text-xs break-words text-blue-600 underline hover:text-blue-800"
                                                                                >
                                                                                    {a.original_name || (a.url ? a.url.split('/').pop() : '')}
                                                                                </a>
                                                                            ) : (
                                                                                <span className="break-words">{a.original_name || ''}</span>
                                                                            )}
                                                                            {a.size ? (
                                                                                <div className="mt-1 text-xs text-gray-500">
                                                                                    {formatBytes(a.size)}
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    )}
                                </div>
                            ) : (
                                postAttachments.length > 0 && (
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
                                                        <div className="flex h-full w-full flex-col items-start justify-center p-2 text-xs">
                                                            {p.url ? (
                                                                <a
                                                                    href={p.url}
                                                                    download={p.original_name || undefined}
                                                                    className="text-xs break-words text-blue-600 underline hover:text-blue-800"
                                                                >
                                                                    {p.original_name || p.url.split('/').pop()}
                                                                </a>
                                                            ) : (
                                                                <span className="break-words">{p.original_name || ''}</span>
                                                            )}
                                                            {p.size ? <div className="mt-1 text-xs text-gray-500">{formatBytes(p.size)}</div> : null}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
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

            {manualModalOpen && (
                <ImageModal images={manualModalImages} startIndex={manualModalStartIndex} onClose={() => setManualModalOpen(false)} />
            )}

            {/* printing handled via hidden iframe injected into document; no in-app modal */}

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
