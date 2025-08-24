import InputError from '@/components/input-error';
import ImageModal from '@/components/posts/image-modal';
import RichTextEditor from '@/components/rich-text-editor-ckeditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'; // New component import
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// declare global Inertia `page` object used by templates
declare const page: any;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'ダッシュボード', href: route('dashboard') },
    { title: '掲示板', href: route('posts.index') },
    { title: '新規投稿', href: route('posts.create') },
];

export default function PostCreate() {
    const { data, setData, processing, errors, reset } = useForm({
        title: '',
        body: '',
    });
    const [attachments, setAttachments] = useState<File[]>([]);
    // default to draft (非公開) instead of public
    const [isPublic, setIsPublic] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [previews, setPreviews] = useState<{ url: string; file: File; isImage: boolean }[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalStartIndex, setModalStartIndex] = useState(0);
    const [bodyHtml, setBodyHtml] = useState<string>('');

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        setAttachments(files);
    }

    // build previews when attachments change
    useEffect(() => {
        // revoke old urls
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
    const [audience, setAudience] = useState<'all' | 'restricted'>('all');
    const [availableRoles, setAvailableRoles] = useState<any[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

    useEffect(() => {
        // fetch roles and users for selection
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

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setServerErrors({});
        const form = new FormData();
        form.append('title', data.title);
        const rawHtml = bodyHtml && bodyHtml.length > 0 ? bodyHtml : data.body || '';

        // transform plain-text #tags and @mentions into spans so class attributes are stored
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
        if (audience === 'restricted') {
            selectedRoles.forEach((id) => form.append('roles[]', String(id)));
            selectedUsers.forEach((id) => form.append('users[]', String(id)));
        }
        // extract simple tags from plain text: #tag (stops at whitespace/#/@)
        try {
            // convert HTML to plain text to avoid capturing tags like </p>
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
            const res = await fetch('/api/posts', {
                method: 'POST',
                credentials: 'same-origin',
                body: form,
                headers: {
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            });

            const contentType = (res.headers.get('content-type') || '').toLowerCase();

            // Debug logging: always log response metadata and body when possible
            try {
                console.log('[posts.create] response meta', { status: res.status, statusText: res.statusText, url: res.url, contentType });
                if (contentType.includes('application/json')) {
                    const payload = await res
                        .clone()
                        .json()
                        .catch(() => null);
                    console.log('[posts.create] response json', payload);
                } else {
                    const text = await res
                        .clone()
                        .text()
                        .catch(() => null);
                    console.log('[posts.create] response text', text && text.slice ? text.slice(0, 2000) : text);
                }
            } catch (logErr) {
                console.error('[posts.create] failed to log response', logErr);
            }

            // handle validation errors (JSON)
            if (res.status === 422 && contentType.includes('application/json')) {
                const payload = await res.json();
                setServerErrors(payload.errors || {});
                return;
            }

            // If server returned HTML (debug page / 419), show text for easier debugging
            if (!contentType.includes('application/json')) {
                const text = await res.text();
                alert('投稿に失敗しました（非JSON応答）: ' + text.slice(0, 1000));
                return;
            }

            if (!res.ok) {
                // JSON error
                const payload = await res.json();
                alert('投稿に失敗しました: ' + (payload.message || JSON.stringify(payload)));
                return;
            }

            // success - navigate to posts index
            reset();
            window.location.href = route('posts.index');
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました');
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="新規投稿" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>新しい投稿を作成</CardTitle>
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
                                <Button disabled={processing}>投稿する</Button>
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
