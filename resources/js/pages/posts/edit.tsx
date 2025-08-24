import InputError from '@/components/input-error';
import ImageModal from '@/components/posts/image-modal';
import RichTextEditor from '@/components/rich-text-editor-ckeditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// declare global Inertia `page` object used by templates
declare const page: any;

const breadcrumbs = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: '掲示板', href: route('posts.index') },
    { title: '投稿編集', href: '' },
];

export default function PostEdit() {
    // We'll read initial post data from window.page.props (Inertia provides it)
    const [initialPost, setInitialPost] = useState<any>((window as any).page?.props?.post || null);

    // initialPost may be provided via Inertia page props

    const { data, setData, processing, errors, reset } = useForm({
        title: initialPost?.title || '',
        body: initialPost?.body || '',
    });

    const [attachments, setAttachments] = useState<File[]>([]);
    // If initialPost exists, use its is_public; otherwise default to draft (false)
    const initialIsPublic = initialPost ? !(initialPost.is_public === false || initialPost.is_public === '0' || initialPost.is_public === 0) : false;
    const [isPublic, setIsPublic] = useState<boolean>(initialIsPublic);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [previews, setPreviews] = useState<any[]>(() => {
        const existing = (initialPost && Array.isArray(initialPost.attachments) ? initialPost.attachments : []) as any[];
        return existing.map((a) => {
            // if backend stored a.file_path (e.g. 'attachments/xxx.jpg' on public disk)
            // convert to a public URL: '/storage/attachments/xxx.jpg'
            let url = a.file_path || a.url || a.path || a.src || '';
            if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                url = '/storage/' + url;
            }
            const isImage = typeof url === 'string' && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url);
            return { url, file: undefined, isImage, existing: true };
        });
    });
    const [modalOpen, setModalOpen] = useState(false);
    const [modalStartIndex, setModalStartIndex] = useState(0);
    const [bodyHtml, setBodyHtml] = useState<string>(initialPost?.body || '');

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        setAttachments(files);
    }

    useEffect(() => {
        setPreviews((prev) => {
            prev.forEach((p) => URL.revokeObjectURL(p.url));
            return [];
        });
        if (!attachments || attachments.length === 0) return;
        const next = attachments.map((f) => ({ url: URL.createObjectURL(f), file: f, isImage: f.type.startsWith('image/') }));
        setPreviews(next);
        return () => {
            next.forEach((p) => URL.revokeObjectURL(p.url));
        };
    }, [attachments]);

    const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
    const [audience, setAudience] = useState<'all' | 'restricted'>(initialPost?.audience || 'all');
    const [availableRoles, setAvailableRoles] = useState<any[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>((initialPost?.roles || []).map((r: any) => Number(r.id)) || []);
    // support both camelCase and snake_case from API: allowedUsers or allowed_users
    const initialAllowedUsers =
        (initialPost &&
            (Array.isArray(initialPost.allowedUsers)
                ? initialPost.allowedUsers
                : Array.isArray(initialPost.allowed_users)
                  ? initialPost.allowed_users
                  : [])) ||
        [];
    const [selectedUsers, setSelectedUsers] = useState<number[]>((initialAllowedUsers || []).map((u: any) => Number(u.id)) || []);

    useEffect(() => {
        // fetch roles and users for selection
        fetch('/api/roles', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => {
                // roles API response
                const roles = (d || []) as Array<{ id: number; name: string }>;
                try {
                    type InertiaPage = { props?: { auth?: { user?: { id?: number; name?: string; roles?: Array<{ id: number; name: string }> } } } };
                    declare const page: InertiaPage | undefined;
                    const currentUser = page?.props?.auth?.user || null;
                    const currentRoleNames = Array.isArray(currentUser?.roles)
                        ? currentUser.roles.map((rr: { id: number; name: string }) => rr.name)
                        : [];
                    // システム管理者はすべて見る
                    let baseList: Array<{ id: number; name: string }> = [];
                    if (currentRoleNames.includes('システム管理者')) {
                        baseList = roles;
                    } else {
                        // 一般ユーザーは自分が所属するロールのみ表示
                        const currentRoleIds = Array.isArray(currentUser?.roles)
                            ? currentUser.roles.map((rr: { id: number; name: string }) => rr.id)
                            : [];
                        baseList = roles.filter((r) => currentRoleIds.includes(r.id));
                    }
                    // ensure initialPost roles are present in the list so the MultiSelect shows selected items
                    const initialRoles = (initialPost && Array.isArray(initialPost.roles) ? initialPost.roles : []) as any[];
                    const merged = [...baseList];
                    initialRoles.forEach((ir) => {
                        if (!merged.find((m) => Number(m.id) === Number(ir.id))) merged.push({ id: Number(ir.id), name: ir.name });
                    });
                    const mapped = merged.map((m) => ({ id: Number(m.id), name: m.name }));
                    setAvailableRoles(mapped);
                    // availableRoles set
                } catch {
                    // fallback - include initialPost roles if any
                    const merged = [...roles];
                    const initialRoles = (initialPost && Array.isArray(initialPost.roles) ? initialPost.roles : []) as any[];
                    initialRoles.forEach((ir) => {
                        if (!merged.find((m) => Number(m.id) === Number(ir.id))) merged.push({ id: Number(ir.id), name: ir.name });
                    });
                    const mapped = merged.map((m) => ({ id: Number(m.id), name: m.name }));
                    setAvailableRoles(mapped);
                    // availableRoles fallback set (roles error)
                }
            })
            .catch(() => {
                // fallback to initialPost roles
                const initialRoles = (initialPost && Array.isArray(initialPost.roles) ? initialPost.roles : []) as any[];
                const mapped = (initialRoles || []).map((r) => ({ id: Number(r.id), name: r.name }));
                setAvailableRoles(mapped);
                // availableRoles network error fallback
            });

        fetch('/api/users', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => {
                // users API response
                const users = (d || []) as any[];
                // merge initialPost.allowedUsers so selected users are visible
                const initialUsers = (initialPost &&
                    (Array.isArray(initialPost.allowedUsers)
                        ? initialPost.allowedUsers
                        : Array.isArray(initialPost.allowed_users)
                          ? initialPost.allowed_users
                          : [])) as any[];
                const merged = [...users];
                initialUsers.forEach((iu) => {
                    if (!merged.find((m) => Number(m.id) === Number(iu.id))) merged.push({ id: Number(iu.id), name: iu.name });
                });
                const usersMapped = merged.map((m) => ({ id: Number(m.id), name: m.name }));
                setAvailableUsers(usersMapped);
                // availableUsers set
            })
            .catch(() => {
                const initialUsers = (initialPost &&
                    (Array.isArray(initialPost.allowedUsers)
                        ? initialPost.allowedUsers
                        : Array.isArray(initialPost.allowed_users)
                          ? initialPost.allowed_users
                          : [])) as any[];
                const usersMapped = (initialUsers || []).map((u) => ({ id: Number(u.id), name: u.name }));
                setAvailableUsers(usersMapped);
                // availableUsers fallback set
            });
    }, [initialPost]);

    // if initialPost is not provided via server props, fetch it from API using the id in the URL
    useEffect(() => {
        if (initialPost) return;
        // attempt to extract id from URL like /posts/:id/edit
        const m = window.location.pathname.match(/\/posts\/(\d+)\/edit/);
        const id = m ? m[1] : null;
        if (!id) return;
        fetch(`/api/posts/${id}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => setInitialPost(d))
            .catch(() => {
                // ignore fetch errors
            });
    }, [initialPost]);

    // when initialPost becomes available, populate form state and related fields
    useEffect(() => {
        if (!initialPost) return;
        try {
            setData('title', initialPost.title || '');
            setData('body', initialPost.body || '');
        } catch (e) {
            // ignore
        }
        setAudience(initialPost.audience || 'all');
        setIsPublic(!(initialPost.is_public === false || initialPost.is_public === '0' || initialPost.is_public === 0));
        const selectedRolesInit = Array.isArray(initialPost.roles) ? initialPost.roles.map((r: any) => Number(r.id)) : [];
        const selectedUsersInit = Array.isArray(initialPost.allowedUsers)
            ? initialPost.allowedUsers.map((u: any) => Number(u.id))
            : Array.isArray(initialPost.allowed_users)
              ? initialPost.allowed_users.map((u: any) => Number(u.id))
              : [];
        setSelectedRoles(selectedRolesInit);
        setSelectedUsers(selectedUsersInit);
        setBodyHtml(initialPost.body || '');
        // populate previews for existing attachments
        const existing = Array.isArray(initialPost.attachments) ? initialPost.attachments : [];
        setPreviews(
            existing.map((a: any) => {
                let url = a.file_path || a.url || a.path || '';
                if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                    url = '/storage/' + url;
                }
                const isImage = typeof url === 'string' && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url);
                return { url, file: undefined, isImage, existing: true };
            }),
        );
        // initialPost applied
    }, [initialPost]);

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setServerErrors({});
        // ensure we determine what to send: if audience is not restricted, we'll send no roles/users
        const rolesToSend = audience === 'restricted' ? selectedRoles : [];
        const usersToSend = audience === 'restricted' ? selectedUsers : [];

        const form = new FormData();
        form.append('title', data.title);
        const rawHtml = bodyHtml && bodyHtml.length > 0 ? bodyHtml : data.body || '';

        const transformHtmlForSave = (raw: string) => {
            const container = document.createElement('div');
            container.innerHTML = raw || '';
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
            const nodes: Node[] = [];
            let n: Node | null = walker.nextNode();
            while (n) {
                nodes.push(n);
                n = walker.nextNode();
            }
            nodes.forEach((tn) => {
                const v = tn.nodeValue || '';
                if (!v) return;
                if (/#([^\s#@]+)|@([^\s@#]+)/.test(v)) {
                    const frag = document.createDocumentFragment();
                    let lastIndex = 0;
                    const re = /(#([^\s#@]+))|(@([^\s@#]+))/g;
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(v))) {
                        const before = v.slice(lastIndex, m.index);
                        if (before) frag.appendChild(document.createTextNode(before));
                        if (m[1]) {
                            const span = document.createElement('span');
                            span.className = 'hashtag';
                            span.textContent = m[1];
                            frag.appendChild(span);
                        } else if (m[3]) {
                            const span = document.createElement('span');
                            span.className = 'mention';
                            span.textContent = m[3];
                            frag.appendChild(span);
                        }
                        lastIndex = re.lastIndex;
                    }
                    const rest = v.slice(lastIndex);
                    if (rest) frag.appendChild(document.createTextNode(rest));
                    tn.parentNode?.replaceChild(frag, tn);
                }
            });
            return container.innerHTML;
        };

        const transformedHtml = transformHtmlForSave(rawHtml);
        form.append('body', transformedHtml);
        form.append('is_public', isPublic ? '1' : '0');
        form.append('audience', audience);
        // append selected roles/users only when restricted; when audience is 'all' we intentionally send none
        if (rolesToSend.length > 0) {
            rolesToSend.forEach((id) => form.append('roles[]', String(id)));
        }
        if (usersToSend.length > 0) {
            usersToSend.forEach((id) => form.append('users[]', String(id)));
        }
        try {
            const tmp = document.createElement('div');
            tmp.innerHTML = rawHtml;
            const text = tmp.textContent || tmp.innerText || '';
            const re = /#([^\s#@]+)/g;
            let m: RegExpExecArray | null = null;
            const seen = new Set<string>();
            while ((m = re.exec(text))) {
                const t = m[1];
                if (t) {
                    const clean = t.trim();
                    if (clean && !seen.has(clean)) {
                        seen.add(clean);
                        form.append('tags[]', clean);
                    }
                }
            }
        } catch {
            // ignore
        }
        attachments.forEach((f) => form.append('attachments[]', f));

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const postId = initialPost?.id;
            // Use POST with method override for updates to avoid client/server Inertia method/version edge cases
            let url = '/api/posts';
            let method: 'POST' | 'PATCH' = 'POST';
            if (postId) {
                url = `/api/posts/${postId}`;
                // Laravel recognizes _method override when using POST
                form.append('_method', 'PATCH');
                method = 'POST';
            }

            const res = await fetch(url, {
                method,
                credentials: 'same-origin',
                body: form,
                headers: {
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            });

            const contentType = (res.headers.get('content-type') || '').toLowerCase();

            // Debug logging
            try {
                console.log('[posts.edit] response meta', { status: res.status, statusText: res.statusText, url: res.url, contentType });
                if (contentType.includes('application/json')) {
                    const payload = await res
                        .clone()
                        .json()
                        .catch(() => null);
                    console.log('[posts.edit] response json', payload);
                } else {
                    const text = await res
                        .clone()
                        .text()
                        .catch(() => null);
                    console.log('[posts.edit] response text', text && text.slice ? text.slice(0, 2000) : text);
                }
            } catch (logErr) {
                console.error('[posts.edit] failed to log response', logErr);
            }

            if (res.status === 422 && contentType.includes('application/json')) {
                const payload = await res.json();
                setServerErrors(payload.errors || {});
                return;
            }

            if (!contentType.includes('application/json')) {
                const text = await res.text();
                alert('投稿に失敗しました（非JSON応答）: ' + text.slice(0, 1000));
                return;
            }

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                alert('投稿に失敗しました: ' + (payload.message || JSON.stringify(payload)));
                return;
            }

            // success - read returned payload (new id on create) and force a full reload to the show page
            const payload = await res.json().catch(() => ({}));
            reset();
            const targetId = postId || payload.id;
            if (targetId) {
                // full page reload ensures latest server-rendered Inertia page and avoids 409/version edge cases
                window.location.href = route('posts.show', targetId);
            } else {
                // fallback to index
                window.location.href = route('posts.index');
            }
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました');
        }
    };

    // When the user selects 全体公開, clear any chosen roles/users in the UI so saved state will be empty
    useEffect(() => {
        if (audience === 'all') {
            setSelectedRoles([]);
            setSelectedUsers([]);
        }
    }, [audience]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="投稿編集" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>投稿を編集</CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="title">
                                        タイトル <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="title" value={data.title} onChange={(e) => setData('title', e.target.value)} required />
                                    <InputError message={errors.title} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="body">本文</Label>
                                    <RichTextEditor
                                        value={data.body}
                                        onChange={(html) => setBodyHtml(html)}
                                        title={data.title}
                                        authorName={(() => {
                                            try {
                                                const page = (window as any).page;
                                                return page?.props?.auth?.user?.name || '';
                                            } catch {
                                                return '';
                                            }
                                        })()}
                                        availableUsers={availableUsers}
                                    />
                                    <InputError message={errors.body} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="attachments">添付</Label>
                                    <div className="flex items-center gap-3">
                                        <input ref={fileInputRef} id="attachments" className="hidden" type="file" multiple onChange={handleFile} />
                                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                            ファイル選択
                                        </Button>
                                        <div className="text-sm text-muted-foreground">{attachments.length} ファイル</div>
                                    </div>

                                    <div className="mt-3 flex items-start gap-3">
                                        {previews.map((p, idx) => (
                                            <div key={idx} className="relative h-20 w-20 overflow-hidden rounded bg-gray-50">
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
                                                    <div className="flex h-full w-full items-center justify-center p-2 text-xs">{p.file.name}</div>
                                                )}
                                                <button
                                                    type="button"
                                                    className="absolute top-1 right-1 rounded bg-white/80 p-0.5 text-gray-700 hover:bg-white"
                                                    onClick={() => {
                                                        setAttachments((prev) => prev.filter((_, i) => i !== idx));
                                                    }}
                                                    title="削除"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {serverErrors.attachments && <InputError message={serverErrors.attachments.join(', ')} className="mt-2" />}
                                </div>

                                <div>
                                    <Label htmlFor="is_public">公開設定</Label>
                                    <div className="mt-2">
                                        <select
                                            id="is_public"
                                            className="rounded border p-2 text-sm"
                                            value={isPublic ? '1' : '0'}
                                            onChange={(e) => setIsPublic(e.target.value === '1')}
                                        >
                                            <option value="1">公開</option>
                                            <option value="0">下書き</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="audience">閲覧範囲</Label>
                                    <div className="mt-2 space-y-2">
                                        <div>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="audience"
                                                    value="all"
                                                    checked={audience === 'all'}
                                                    onChange={() => setAudience('all')}
                                                />
                                                <span className="ml-2">全体公開（すべてのユーザーに表示）</span>
                                            </label>
                                        </div>
                                        <div>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="audience"
                                                    value="restricted"
                                                    checked={audience === 'restricted'}
                                                    onChange={() => setAudience('restricted')}
                                                />
                                                <span className="ml-2">限定公開（ロールまたはユーザーを指定）</span>
                                            </label>
                                        </div>

                                        {audience === 'restricted' && (
                                            <div className="mt-4 space-y-4 rounded-md border bg-muted/30 p-4">
                                                <div>
                                                    <Label className="text-sm font-medium">ロールで指定</Label>
                                                    <MultiSelectCombobox
                                                        options={availableRoles.map((r) => ({
                                                            value: r.id,
                                                            label: r.name,
                                                        }))}
                                                        selected={selectedRoles}
                                                        onChange={setSelectedRoles}
                                                        placeholder="ロールを選択..."
                                                        className="mt-2"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-sm font-medium">ユーザーで指定</Label>
                                                    <MultiSelectCombobox
                                                        options={availableUsers.map((u) => ({
                                                            value: u.id,
                                                            label: u.name,
                                                        }))}
                                                        selected={selectedUsers}
                                                        onChange={setSelectedUsers}
                                                        placeholder="ユーザーを選択..."
                                                        className="mt-2"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('posts.index')}>
                                    <Button variant="outline" type="button">
                                        キャンセル
                                    </Button>
                                </Link>
                                <Button disabled={processing}>更新する</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>

            {modalOpen && (
                <ImageModal
                    images={previews.filter((p) => p.isImage).map((p) => p.url)}
                    startIndex={modalStartIndex}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </AppSidebarLayout>
    );
}
