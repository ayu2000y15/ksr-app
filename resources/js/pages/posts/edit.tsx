import InputError from '@/components/input-error';
import ImageModal from '@/components/posts/image-modal';
import RichTextEditor from '@/components/rich-text-editor-ckeditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Textarea } from '@/components/ui/textarea';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// declare global Inertia `page` object used by templates
declare const page: any;

const breadcrumbs = [
    { title: '掲示板', href: route('posts.index') },
    { title: '投稿編集', href: '' },
];

export default function PostEdit() {
    const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.txt', '.xlsx'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    // We'll read initial post data from window.page.props (Inertia provides it)
    const [initialPost, setInitialPost] = useState<any>((window as any).page?.props?.post || null);

    // ...existing code...

    // initialPost may be provided via Inertia page props

    const { data, setData, processing, errors, reset } = useForm({
        type: initialPost?.type || 'board',
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
            const size = a.size || a.file_size || a.byte_size || a.filesize || null;
            const original_name = a.original_name || a.name || null;
            return { id: a.id, url, file: undefined, isImage, existing: true, original_name, size };
        });
    });
    // keep previews in sync with newly selected attachments (created blob URLs)
    useEffect(() => {
        // build previews: keep any existing previews (existing === true) and recreate previews for current attachments
        setPreviews((prev) => {
            // revoke previous non-existing blob URLs
            prev.forEach((p) => {
                try {
                    if (!p.existing && p.url) {
                        URL.revokeObjectURL(p.url);
                    }
                } catch (e) {
                    // ignore
                }
            });
            const existingPreviews = prev.filter((p) => p.existing);
            const newCreated = (attachments || []).map((f) => ({
                url: URL.createObjectURL(f),
                file: f,
                isImage: f.type.startsWith('image/'),
                existing: false,
            }));
            return [...existingPreviews, ...newCreated];
        });

        return () => {
            // cleanup created URLs on unmount
            try {
                (attachments || []).forEach((f) => {
                    // we don't have direct url here; best-effort: nothing to do
                });
            } catch (e) {}
        };
    }, [attachments]);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalStartIndex, setModalStartIndex] = useState(0);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [manualModalImages, setManualModalImages] = useState<string[]>([]);
    const [manualModalStartIndex, setManualModalStartIndex] = useState(0);
    const [bodyHtml, setBodyHtml] = useState<string>(initialPost?.body || '');
    const [manualItems, setManualItems] = useState<any[]>(
        initialPost && Array.isArray(initialPost.items)
            ? initialPost.items.map((it: any) => ({ id: it.id, text: it.content || '', files: [], previews: [] }))
            : [{ text: '', files: [], previews: [] }],
    );
    const dragSrcIndex = React.useRef<number | null>(null);
    // Initialize manualTag from existing post tags (if any) so they show in the edit input
    const existingTagsStr =
        initialPost && Array.isArray(initialPost.tags)
            ? initialPost.tags
                  .map((t: any) => (typeof t === 'string' ? t : t.name || ''))
                  .filter(Boolean)
                  .join(',')
            : '';
    const [manualTag, setManualTag] = useState<string>(initialPost?.body || existingTagsStr || '');

    const moveItem = (from: number, to: number) => {
        setManualItems((prev: any[]) => {
            const copy = [...prev];
            if (from < 0 || from >= copy.length) return prev;
            const item = copy.splice(from, 1)[0];
            copy.splice(to, 0, item);
            return copy;
        });
    };

    const onDragStartItem = (e: React.DragEvent, idx: number) => {
        e.dataTransfer.effectAllowed = 'move';
        try {
            e.dataTransfer.setData('text/plain', String(idx));
        } catch (err) {}
        dragSrcIndex.current = idx;
    };

    const onDragOverItem = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
    };

    const onDropItem = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        const fromStr = e.dataTransfer.getData('text/plain');
        const from = fromStr ? Number(fromStr) : dragSrcIndex.current;
        if (from == null || isNaN(from)) return;
        if (from === idx) return;
        setManualItems((prev: any[]) => {
            const copy = [...prev];
            const item = copy.splice(from, 1)[0];
            const target = from < idx ? idx : idx;
            copy.splice(target, 0, item);
            return copy;
        });
        dragSrcIndex.current = null;
    };
    const manualFileInputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

    const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
    const [audience, setAudience] = useState<'all' | 'restricted'>('all');
    const [availableRoles, setAvailableRoles] = useState<any[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    // track ids of attachments deleted by the user so server can remove them from storage/db
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);
    // ...existing code...

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        // validate extensions and prevent duplicate file names
        const existingNames = new Set(attachments.map((f) => f.name));
        const toAdd: File[] = [];
        const dupNames: string[] = [];
        const invalidNames: string[] = [];
        const oversizeNames: string[] = [];
        files.forEach((f) => {
            const parts = f.name.split('.');
            const ext = parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                invalidNames.push(f.name);
                return;
            }
            if (f.size && f.size > MAX_FILE_SIZE) {
                oversizeNames.push(f.name);
                return;
            }
            if (existingNames.has(f.name)) {
                dupNames.push(f.name);
            } else {
                existingNames.add(f.name);
                toAdd.push(f);
            }
        });
        const msgs: string[] = [];
        if (dupNames.length > 0) msgs.push(`同名のファイルは既に選択されています: ${dupNames.join(', ')}`);
        if (invalidNames.length > 0) msgs.push(`使用できないファイル形式です: ${invalidNames.join(', ')}`);
        if (msgs.length > 0) {
            setServerErrors((prev) => ({ ...prev, attachments: msgs }));
        } else {
            setServerErrors((s) => {
                const copy = { ...s } as Record<string, string[]>;
                delete copy.attachments;
                return copy;
            });
        }
        if (toAdd.length > 0) setAttachments((prev) => [...prev, ...toAdd]);
    }

    function formatBytes(bytes?: number) {
        if (bytes === undefined || bytes === null) return '';
        if (bytes < 1024) return bytes + ' B';
        const kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(kb < 10 ? 2 : 1) + ' KB';
        const mb = kb / 1024;
        return mb.toFixed(2) + ' MB';
    }

    useEffect(() => {
        // fetch roles and users for selection (match posts/create behavior)
        fetch('/api/roles', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => {
                const roles = (d || []) as Array<{ id: number; name: string }>;
                try {
                    type InertiaPage = { props?: { auth?: { user?: { id?: number; name?: string; roles?: Array<{ id: number; name: string }> } } } };
                    declare const page: InertiaPage | undefined;
                    const currentUser = page?.props?.auth?.user || null;

                    const currentRoleNames = Array.isArray(currentUser?.roles)
                        ? currentUser.roles.map((rr: { id: number; name: string }) => rr.name)
                        : [];
                    // システム管理者はすべて見る
                    if (currentRoleNames.includes('システム管理者')) {
                        setAvailableRoles(roles);
                    } else {
                        // 一般ユーザーは自分が所属するロールのみ表示
                        const currentRoleIds = Array.isArray(currentUser?.roles)
                            ? currentUser.roles.map((rr: { id: number; name: string }) => rr.id)
                            : [];
                        const filtered = roles.filter((r) => currentRoleIds.includes(r.id));
                        setAvailableRoles(filtered);
                    }
                } catch {
                    setAvailableRoles(roles);
                }
            })
            .catch(() => setAvailableRoles([]));

        fetch('/api/users', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => setAvailableUsers(d || []))
            .catch(() => setAvailableUsers([]));
    }, []);

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
        // ...existing code...
        try {
            setData('title', initialPost.title || '');
            setData('body', initialPost.body || '');
            // Ensure the post type is applied to the form (fix: manual posts previously showed as board)
            setData('type', initialPost.type || 'board');
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
        // populate previews for existing attachments (post-level)
        const existing = Array.isArray(initialPost.attachments) ? initialPost.attachments : [];
        setPreviews(
            existing.map((a: any) => {
                let url = a.file_path || a.url || a.path || '';
                if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                    url = '/storage/' + url;
                }
                const isImage = typeof url === 'string' && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url);
                const size = a.size || a.file_size || a.byte_size || a.filesize || null;
                const original_name = a.original_name || a.name || null;
                return { id: a.id, url, file: undefined, isImage, existing: true, original_name, size };
            }),
        );

        // populate manual items (if any) so edit form shows existing items for manual posts
        const itemsSource = Array.isArray(initialPost.items)
            ? initialPost.items
            : Array.isArray(initialPost.post_items)
              ? initialPost.post_items
              : Array.isArray(initialPost.postItems)
                ? initialPost.postItems
                : [];
        if (itemsSource && itemsSource.length > 0) {
            const itemsInit = itemsSource.map((it: any) => {
                const itemPreviews = Array.isArray(it.attachments)
                    ? it.attachments.map((a: any) => {
                          let url = a.file_path || a.url || a.path || '';
                          if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                              url = '/storage/' + url;
                          }
                          const isImage = typeof url === 'string' && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url);
                          const size = a.size || a.file_size || a.byte_size || a.filesize || null;
                          const original_name = a.original_name || a.name || null;
                          return { id: a.id, url, file: undefined, isImage, existing: true, original_name, size };
                      })
                    : [];
                return { id: it.id, text: it.content || it.text || '', files: [], previews: itemPreviews };
            });
            setManualItems(itemsInit as any);
        }
        // populate manualTag from existing tags (if any) so edit input shows current tags
        try {
            const tagsSource = Array.isArray(initialPost.tags)
                ? initialPost.tags
                : Array.isArray(initialPost.tag_list)
                  ? initialPost.tag_list
                  : Array.isArray(initialPost.tags_list)
                    ? initialPost.tags_list
                    : null;
            if (Array.isArray(tagsSource) && tagsSource.length > 0) {
                const joined = tagsSource
                    .map((t: any) => (typeof t === 'string' ? t : t.name || ''))
                    .filter(Boolean)
                    .join(',');
                setManualTag(joined);
            }
        } catch (e) {
            // ignore
        }
        // initialPost applied
    }, [initialPost]);

    // compute whether we're editing a manual post - fall back to initialPost.type if form data isn't set yet
    const isManual = data.type === 'manual' || (initialPost && initialPost.type === 'manual');

    // DEBUG: watch data.type and manualItems to help diagnose rendering issue
    useEffect(() => {
        // ...existing code...
    }, [data.type, manualItems]);

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
        // client-side validation: for board posts, body is required
        if ((data.type || 'board') === 'board') {
            if (!transformedHtml || transformedHtml.replace(/<[^>]*>/g, '').trim() === '') {
                setServerErrors((prev) => {
                    const copy = { ...prev } as Record<string, string[]>;
                    copy.body = ['本文は必須です'];
                    return copy;
                });
                return;
            }
        }
        form.append('type', data.type || 'board');
        form.append('is_public', isPublic ? '1' : '0');
        form.append('audience', audience);
        // append selected roles/users only when restricted; when audience is 'all' we intentionally send none
        if (rolesToSend.length > 0) {
            rolesToSend.forEach((id) => form.append('roles[]', String(id)));
        }
        if (usersToSend.length > 0) {
            usersToSend.forEach((id) => form.append('users[]', String(id)));
        }
        // include any existing attachment ids the user deleted so server can remove them
        if ((deletedAttachmentIds || []).length > 0) {
            deletedAttachmentIds.forEach((id) => form.append('deleted_attachment_ids[]', String(id)));
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
        // send attachments/body only for board posts; send manual items only for manual posts
        if ((data.type || 'board') === 'board') {
            form.append('body', transformedHtml);
            attachments.forEach((f) => form.append('attachments[]', f));
        }
        // for manual posts, DO NOT save manualTag into body; we send tags[] separately

        // If manual type, also parse comma-separated manualTag into tags[] so server treats them like board tags
        if ((data.type || 'board') === 'manual') {
            if (manualTag && manualTag.trim()) {
                const parts = manualTag
                    .split(/[,，\s]+/) // allow comma, fullwidth comma, and whitespace
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);
                parts.forEach((t) => form.append('tags[]', t));
            }
        }

        if ((data.type || 'board') === 'manual') {
            manualItems.forEach((it, i) => {
                if (it.id) {
                    form.append(`items[${i}][id]`, String(it.id));
                }
                form.append(`items[${i}][order]`, String(i + 1));
                form.append(`items[${i}][content]`, it.text || '');
                (it.files || []).forEach((f) => form.append(`item_attachments[${i}][]`, f));
            });
        }

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
            // response handling

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
                                {Object.keys(serverErrors || {}).length > 0 && (
                                    <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                        <div className="font-medium">入力エラーがあります。以下を修正してください：</div>
                                        <ul className="mt-2 list-disc pl-5">
                                            {Object.entries(serverErrors).map(([field, msgs]) =>
                                                (msgs || []).map((m, i) => <li key={`${field}-${i}`}>{m}</li>),
                                            )}
                                        </ul>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="title">
                                        タイトル <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="title" value={data.title} onChange={(e) => setData('title', e.target.value)} required />
                                    <InputError message={errors.title} className="mt-2" />
                                </div>

                                {isManual && (
                                    <div className="space-y-4">
                                        <Label>マニュアル項目</Label>
                                        <div className="mt-2 flex items-start gap-2 rounded border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-800">
                                            <Info className="h-5 w-5 flex-shrink-0 text-yellow-700" />
                                            <div>項目はドラッグで並び替えできます（モバイルでは上下ボタンで移動してください）</div>
                                        </div>
                                        {manualItems.map((it, idx) => (
                                            <div
                                                key={idx}
                                                className="rounded border p-3"
                                                draggable
                                                onDragStart={(e) => onDragStartItem(e as any, idx)}
                                                onDragOver={(e) => onDragOverItem(e as any, idx)}
                                                onDrop={(e) => onDropItem(e as any, idx)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm font-medium">項目 {idx + 1}</div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="p-1 text-gray-600 hover:text-gray-800"
                                                            onClick={() => moveItem(idx, Math.max(0, idx - 1))}
                                                            title="上へ移動"
                                                        >
                                                            <ChevronUp className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="p-1 text-gray-600 hover:text-gray-800"
                                                            onClick={() => moveItem(idx, Math.min(manualItems.length - 1, idx + 1))}
                                                            title="下へ移動"
                                                        >
                                                            <ChevronDown className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="text-sm text-red-500"
                                                            onClick={() => setManualItems((prev) => prev.filter((_, i) => i !== idx))}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <Label>画像 (任意、複数)</Label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            ref={(el) => (manualFileInputsRef.current[idx] = el)}
                                                            id={`item_attachments_${idx}`}
                                                            className="hidden"
                                                            type="file"
                                                            multiple
                                                            onChange={(e) => {
                                                                const files = e.target.files ? Array.from(e.target.files) : [];
                                                                setServerErrors((s) => {
                                                                    const copy = { ...s } as Record<string, string[]>;
                                                                    delete copy.attachments;
                                                                    return copy;
                                                                });
                                                                setManualItems((prev) => {
                                                                    const copy = [...prev];
                                                                    const existingFiles = copy[idx].files || [];
                                                                    const existingNames = new Set(existingFiles.map((f) => f.name));
                                                                    const toAdd: File[] = [];
                                                                    const dupNames: string[] = [];
                                                                    files.forEach((f) => {
                                                                        if (existingNames.has(f.name)) {
                                                                            dupNames.push(f.name);
                                                                        } else {
                                                                            existingNames.add(f.name);
                                                                            toAdd.push(f);
                                                                        }
                                                                    });
                                                                    if (dupNames.length > 0) {
                                                                        setServerErrors((prev) => ({
                                                                            ...prev,
                                                                            attachments: [
                                                                                `同名のファイルは既に選択されています: ${dupNames.join(', ')}`,
                                                                            ],
                                                                        }));
                                                                    }
                                                                    const newFiles = [...existingFiles, ...toAdd];
                                                                    const newPreviews = [
                                                                        ...(copy[idx].previews || []),
                                                                        ...toAdd.map((f) => ({
                                                                            url: URL.createObjectURL(f),
                                                                            file: f,
                                                                            isImage: f.type.startsWith('image/'),
                                                                        })),
                                                                    ];
                                                                    copy[idx] = { ...copy[idx], files: newFiles, previews: newPreviews };
                                                                    return copy;
                                                                });
                                                            }}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => manualFileInputsRef.current[idx]?.click()}
                                                        >
                                                            ファイル選択
                                                        </Button>
                                                        <div className="text-sm text-muted-foreground">
                                                            {(it.previews || []).filter((p: any) => p.existing).length + (it.files || []).length}{' '}
                                                            ファイル
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex items-start gap-3">
                                                        {(it.previews || []).map((p, i) => (
                                                            <div
                                                                key={i}
                                                                className="relative flex w-28 flex-col items-center overflow-hidden rounded bg-gray-50"
                                                            >
                                                                {p.isImage ? (
                                                                    <img
                                                                        src={p.url}
                                                                        alt={`item ${idx} attachment ${i + 1}`}
                                                                        className="h-20 w-20 cursor-pointer object-cover"
                                                                        onClick={() => {
                                                                            const imgs = (it.previews || [])
                                                                                .filter((pp: any) => pp.isImage)
                                                                                .map((pp: any) => pp.url);
                                                                            setManualModalImages(imgs);
                                                                            setManualModalStartIndex(
                                                                                (imgs.findIndex((u: string) => u === p.url) + imgs.length) %
                                                                                    imgs.length,
                                                                            );
                                                                            setManualModalOpen(true);
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-20 w-20 items-center justify-center p-2 text-xs">
                                                                        <div className="text-center">
                                                                            {p.original_name || p.file?.name || 'ファイル'}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="text-xs text-gray-500">
                                                                    {typeof p.size === 'number'
                                                                        ? formatBytes(p.size)
                                                                        : p.file
                                                                          ? formatBytes(p.file.size)
                                                                          : ''}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="absolute top-1 right-1 rounded bg-white/80 px-1 text-gray-700 hover:bg-white"
                                                                    onClick={() => {
                                                                        setManualItems((prev) => {
                                                                            const copy = [...prev];
                                                                            const preview = copy[idx].previews && copy[idx].previews[i];
                                                                            if (preview && preview.existing && preview.id) {
                                                                                setDeletedAttachmentIds((dprev) => [...dprev, preview.id]);
                                                                            }
                                                                            copy[idx] = {
                                                                                ...copy[idx],
                                                                                files: (copy[idx].files || []).filter((_, j) => j !== i),
                                                                                previews: (copy[idx].previews || []).filter((_, j) => j !== i),
                                                                            };
                                                                            return copy;
                                                                        });
                                                                    }}
                                                                    title="削除"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <Label>
                                                        説明 <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Textarea
                                                        rows={3}
                                                        value={it.text}
                                                        required
                                                        onChange={(e) =>
                                                            setManualItems((prev) => {
                                                                const copy = [...prev];
                                                                copy[idx] = { ...copy[idx], text: e.target.value };
                                                                return copy;
                                                            })
                                                        }
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <div>
                                            <button
                                                type="button"
                                                className="rounded bg-indigo-600 px-3 py-1 text-white"
                                                onClick={() => setManualItems((prev) => [...prev, { text: '', files: [], previews: [] }])}
                                            >
                                                項目を追加
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!isManual && (
                                    <>
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
                                            <InputError
                                                message={
                                                    errors.body ||
                                                    (serverErrors.body
                                                        ? Array.isArray(serverErrors.body)
                                                            ? serverErrors.body.join(', ')
                                                            : serverErrors.body
                                                        : undefined)
                                                }
                                                className="mt-2"
                                            />
                                        </div>

                                        <div className="text-sm text-muted-foreground">
                                            <p>
                                                <span className="font-medium">タグの付け方</span>
                                                <br></br>・本文中に <span className="font-medium">#タグ名</span> の形式で記載してください。
                                                <br></br>・複数指定する場合はスペースで区切ります。<br></br>
                                                ・タグは投稿後に一覧で表示され、タグをクリックするとそのタグが付いた投稿のみ検索できます。
                                            </p>
                                        </div>

                                        <div>
                                            <Label htmlFor="attachments">添付</Label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    ref={fileInputRef}
                                                    id="attachments"
                                                    className="hidden"
                                                    type="file"
                                                    multiple
                                                    onChange={handleFile}
                                                />
                                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                    ファイル選択
                                                </Button>
                                                <div className="text-sm text-muted-foreground">
                                                    {previews.filter((p) => p.existing).length + attachments.length} ファイル
                                                </div>
                                            </div>

                                            <div className="mt-2 text-sm text-muted-foreground">
                                                使用可能なファイル形式: .png .jpg .jpeg .gif .pdf .txt .xlsx
                                            </div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                ファイルサイズは1ファイルあたり最大10MBまでです。
                                            </div>

                                            <div className="mt-3 flex items-start gap-3">
                                                {previews.map((p, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="relative flex w-28 flex-col items-center overflow-hidden rounded bg-gray-50"
                                                    >
                                                        {p.isImage ? (
                                                            <img
                                                                src={p.url}
                                                                alt={`attachment ${idx + 1}`}
                                                                className="h-20 w-20 cursor-pointer object-cover"
                                                                onClick={() => {
                                                                    setModalStartIndex(idx);
                                                                    setModalOpen(true);
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="flex h-20 w-20 items-center justify-center p-2 text-xs">
                                                                <div className="text-center">{p.original_name || p.file?.name || 'ファイル'}</div>
                                                            </div>
                                                        )}

                                                        <div className="text-xs text-gray-500">
                                                            {typeof p.size === 'number'
                                                                ? formatBytes(p.size)
                                                                : p.file
                                                                  ? formatBytes(p.file.size)
                                                                  : ''}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="absolute top-1 right-1 rounded bg-white/80 p-0.5 text-gray-700 hover:bg-white"
                                                            onClick={() => {
                                                                // If this preview corresponds to an existing attachment, remember its id for deletion
                                                                if (p.existing && p.id) {
                                                                    setDeletedAttachmentIds((prev) => [...prev, p.id]);
                                                                }
                                                                // If this preview was created from a newly selected File, revoke its blob URL and remove the File from attachments
                                                                if (!p.existing && p.file) {
                                                                    try {
                                                                        if (p.url) URL.revokeObjectURL(p.url);
                                                                    } catch (e) {}
                                                                    setAttachments((prev) =>
                                                                        prev.filter(
                                                                            (f) =>
                                                                                !(
                                                                                    f.name === p.file.name &&
                                                                                    f.size === p.file.size &&
                                                                                    f.lastModified === p.file.lastModified
                                                                                ),
                                                                        ),
                                                                    );
                                                                }
                                                                setPreviews((prev) => prev.filter((_, i) => i !== idx));
                                                            }}
                                                            title="削除"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {serverErrors.attachments && (
                                                <InputError message={serverErrors.attachments.join(', ')} className="mt-2" />
                                            )}
                                        </div>
                                    </>
                                )}

                                {isManual && (
                                    <div>
                                        <Label htmlFor="manual_tag">タグ</Label>
                                        <Input
                                            id="manual_tag"
                                            type="text"
                                            value={manualTag}
                                            onChange={(e) => setManualTag(e.target.value)}
                                            placeholder="タグを入力 (例: 機材名)"
                                            className="mt-2"
                                        />
                                        <div className="text-sm text-muted-foreground">
                                            <p>
                                                <span className="font-medium">タグの付け方</span>
                                                <br></br>・本文中に <span className="font-medium">#タグ名</span> の形式で記載してください。
                                                <br></br>・複数指定する場合はスペースで区切ります。<br></br>
                                                ・タグは投稿後に一覧で表示され、タグをクリックするとそのタグが付いた投稿のみ検索できます。
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="is_public">公開設定</Label>
                                    <div className="mt-2">
                                        <select
                                            id="is_public"
                                            className="w-full rounded border p-2 text-sm"
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
            {manualModalOpen && (
                <ImageModal images={manualModalImages} startIndex={manualModalStartIndex} onClose={() => setManualModalOpen(false)} />
            )}
        </AppSidebarLayout>
    );
}
