import InputError from '@/components/input-error';
import ImageModal from '@/components/posts/image-modal';
import RichTextEditor from '@/components/rich-text-editor-ckeditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'; // New component import
import { Textarea } from '@/components/ui/textarea';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// declare global Inertia `page` object used by templates
declare const page: any;

const breadcrumbs: BreadcrumbItem[] = [
    { title: '掲示板', href: route('posts.index') },
    { title: '新規投稿', href: route('posts.create') },
];

export default function PostCreate() {
    const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.txt', '.xlsx'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const { data, setData, processing, errors, reset } = useForm({
        type: 'board',
        title: '',
        body: '',
        poll: {
            description: '',
            expires_at: '',
            option_type: 'text',
            allow_multiple_votes: false,
            is_anonymous: false,
            options: [{ value: '' }, { value: '' }],
        },
    });
    const [submitting, setSubmitting] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    // default to draft (非公開) instead of public
    const [isPublic, setIsPublic] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [previews, setPreviews] = useState<{ url: string; file: File; isImage: boolean }[]>([]);
    const [manualItems, setManualItems] = useState<
        Array<{ text: string; files: File[]; previews: { url: string; file?: File; isImage: boolean }[] }>
    >([{ text: '', files: [], previews: [] }]);
    const dragSrcIndex = React.useRef<number | null>(null);

    const moveItem = (from: number, to: number) => {
        setManualItems((prev) => {
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
        // compute new index after removal
        setManualItems((prev) => {
            const copy = [...prev];
            const item = copy.splice(from, 1)[0];
            // if moving forward, and removing earlier index, adjust target index
            const target = from < idx ? idx : idx;
            copy.splice(target, 0, item);
            return copy;
        });
        dragSrcIndex.current = null;
    };
    const manualFileInputsRef = React.useRef<Array<HTMLInputElement | null>>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalStartIndex, setModalStartIndex] = useState(0);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [manualModalImages, setManualModalImages] = useState<string[]>([]);
    const [manualModalStartIndex, setManualModalStartIndex] = useState(0);
    const [bodyHtml, setBodyHtml] = useState<string>('');
    const [manualTag, setManualTag] = useState<string>('');

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

    // 投票選択肢を更新するヘルパー関数
    const handlePollOptionChange = (index: number, value: string) => {
        const newOptions = [...data.poll.options];
        newOptions[index].value = value;
        setData('poll', { ...data.poll, options: newOptions });
    };

    // 投票選択肢を追加するヘルパー関数
    const addPollOption = () => {
        setData('poll', {
            ...data.poll,
            options: [...data.poll.options, { value: '' }],
        });
    };

    // 投票選択肢を削除するヘルパー関数
    const removePollOption = (index: number) => {
        if (data.poll.options.length <= 2) return; // 最低2つは必須
        const newOptions = data.poll.options.filter((_, i) => i !== index);
        setData('poll', { ...data.poll, options: newOptions });
    };

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
    // autosave removed

    useEffect(() => {
        // fetch roles and users for selection
        fetch('/api/roles', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => {
                const roles = (d || []) as Array<{ id: number; name: string }>;
                try {
                    type InertiaPage = { props?: { auth?: { user?: { id?: number; name?: string; roles?: Array<{ id: number; name: string }> } } } };
                    const page = (window as unknown as { page?: any }).page as InertiaPage | undefined;
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

        // client-side validation: for board posts, body is required
        const rawHtml = bodyHtml && bodyHtml.length > 0 ? bodyHtml : data.body || '';
        const strip = (s: string) => s.replace(/<[^>]*>/g, '').trim();
        if ((data.type || 'board') === 'board') {
            if (!rawHtml || strip(rawHtml) === '') {
                setServerErrors((prev) => ({ ...(prev || {}), body: ['本文は必須です'] }));
                return;
            }
        }

        // FormDataの準備
        const form = new FormData();
        form.append('type', data.type);
        form.append('title', data.title);
        form.append('is_public', isPublic ? '1' : '0');
        form.append('audience', audience);

        if (audience === 'restricted') {
            selectedRoles.forEach((id) => form.append('roles[]', String(id)));
            selectedUsers.forEach((id) => form.append('users[]', String(id)));
        }

        // --- タイプに応じたデータ処理 ---

        if (data.type === 'board') {
            form.append('body', bodyHtml);
            attachments.forEach((f) => form.append('attachments[]', f));
            // 本文からタグを抽出
            try {
                const tmp = document.createElement('div');
                tmp.innerHTML = bodyHtml;
                const text = tmp.textContent || tmp.innerText || '';
                const re = /#([^\s#@]+)/g;
                let m: RegExpExecArray | null = null;
                const seen = new Set<string>();
                while ((m = re.exec(text))) {
                    if (m[1] && !seen.has(m[1].trim())) {
                        const cleanTag = m[1].trim();
                        seen.add(cleanTag);
                        form.append('tags[]', cleanTag);
                    }
                }
            } catch {}
        }

        if (data.type === 'manual') {
            manualItems.forEach((it, i) => {
                form.append(`items[${i}][content]`, it.text || '');
                (it.files || []).forEach((f) => form.append(`item_attachments[${i}][]`, f));
            });
            // 手動タグ入力欄からタグを追加
            if (manualTag && manualTag.trim()) {
                manualTag
                    .split(/[,，\s]+/)
                    .filter(Boolean)
                    .forEach((t) => form.append('tags[]', t.trim()));
            }
        }

        // ★★★ ここからが投票データの追加部分です ★★★
        if (data.type === 'poll') {
            // include poll description (nullable)
            form.append('poll[description]', data.poll.description || '');
            // fallback key in case server expects non-nested field
            form.append('poll_description', data.poll.description || '');
            form.append('poll[expires_at]', data.poll.expires_at || '');
            form.append('poll[option_type]', data.poll.option_type);
            form.append('poll[allow_multiple_votes]', data.poll.allow_multiple_votes ? '1' : '0');
            form.append('poll[is_anonymous]', data.poll.is_anonymous ? '1' : '0');
            data.poll.options.forEach((option, index) => {
                form.append(`poll[options][${index}][value]`, option.value);
            });
            // 投票の場合も手動タグ入力欄をtags[]として送信
            if (manualTag && manualTag.trim()) {
                manualTag
                    .split(/[,，\s]+/)
                    .filter(Boolean)
                    .forEach((t) => form.append('tags[]', t.trim()));
            }
        }

        // --- サーバーへの送信処理 ---
        try {
            setSubmitting(true);
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(route('posts.store'), {
                method: 'POST',
                credentials: 'same-origin',
                body: form,
                headers: {
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            });

            if (res.status === 422) {
                const payload = await res.json();
                setServerErrors(payload.errors || {});
                return;
            }

            if (!res.ok) {
                const text = await res.text();
                alert('投稿に失敗しました: ' + text.slice(0, 500));
                return;
            }

            reset();
            // リダイレクト時に通知メッセージをクエリで渡す
            try {
                const notice = encodeURIComponent(`「${data.title || '(無題)'}」を投稿しました`);
                window.location.href = route('posts.index') + `?notice=${notice}`;
            } catch {
                window.location.href = route('posts.index');
            }
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="新規投稿" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        {/* autosave disabled - no periodic saves */}
                        {/* show server-side / validation errors in a clear summary */}
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
                        <Card>
                            <CardHeader>
                                <CardTitle>新しい投稿を作成</CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="type">投稿タイプ</Label>
                                    <div className="mt-2">
                                        <select
                                            id="type"
                                            className="w-full rounded border p-2 text-sm"
                                            value={data.type}
                                            onChange={(e) => setData('type', e.target.value)}
                                        >
                                            <option value="board">掲示板</option>
                                            <option value="manual">マニュアル</option>
                                            <option value="poll">投票</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="title">
                                        タイトル <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="title" value={data.title} onChange={(e) => setData('title', e.target.value)} required />
                                    <InputError message={errors.title} className="mt-2" />
                                </div>

                                {data.type === 'manual' && (
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
                                                        <div className="text-sm text-muted-foreground">{(it.files || []).length} ファイル</div>
                                                    </div>

                                                    <div className="mt-3 flex items-start gap-3">
                                                        {(it.previews || []).map((p, i) => (
                                                            <div key={i} className="relative h-20 w-20 overflow-hidden rounded bg-gray-50">
                                                                {p.isImage ? (
                                                                    <img
                                                                        src={p.url}
                                                                        alt={`item ${idx} attachment ${i + 1}`}
                                                                        className="h-full w-full cursor-pointer object-cover"
                                                                        onClick={() => {
                                                                            // open modal for this item's images
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
                                                                    <div className="flex h-full w-full items-center justify-center p-2 text-xs">
                                                                        ファイル
                                                                    </div>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className="absolute top-1 right-1 rounded bg-white/80 px-1 text-gray-700 hover:bg-white"
                                                                    onClick={() => {
                                                                        setManualItems((prev) => {
                                                                            const copy = [...prev];
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

                                {data.type === 'poll' && (
                                    <div className="space-y-6 rounded-md border bg-muted/30 p-4">
                                        <h3 className="font-medium">投票設定</h3>
                                        <div>
                                            <Label htmlFor="poll_description">説明 (任意)</Label>
                                            <Textarea
                                                id="poll_description"
                                                rows={3}
                                                value={data.poll.description || ''}
                                                onChange={(e) => setData('poll', { ...data.poll, description: e.target.value })}
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="expires_at">投票期限 (任意)</Label>
                                            <Input
                                                id="expires_at"
                                                type="datetime-local"
                                                value={data.poll.expires_at}
                                                onChange={(e) => setData('poll', { ...data.poll, expires_at: e.target.value })}
                                            />
                                            <InputError message={errors['poll.expires_at']} className="mt-2" />
                                        </div>
                                        <div>
                                            <Label>選択肢の形式</Label>
                                            <div className="mt-2 flex gap-4">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        value="text"
                                                        checked={data.poll.option_type === 'text'}
                                                        onChange={() => setData('poll', { ...data.poll, option_type: 'text' })}
                                                    />{' '}
                                                    テキスト
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        value="date"
                                                        checked={data.poll.option_type === 'date'}
                                                        onChange={() => setData('poll', { ...data.poll, option_type: 'date' })}
                                                    />{' '}
                                                    日付
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>投票方式</Label>
                                            <div className="mt-2 flex gap-4">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="allow_multiple_votes"
                                                        checked={!data.poll.allow_multiple_votes}
                                                        onChange={() => setData('poll', { ...data.poll, allow_multiple_votes: false })}
                                                    />{' '}
                                                    1つだけ選択
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="allow_multiple_votes"
                                                        checked={data.poll.allow_multiple_votes}
                                                        onChange={() => setData('poll', { ...data.poll, allow_multiple_votes: true })}
                                                    />{' '}
                                                    複数選択可
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>記名方式</Label>
                                            <div className="mt-2 flex gap-4">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="is_anonymous"
                                                        checked={!data.poll.is_anonymous}
                                                        onChange={() => setData('poll', { ...data.poll, is_anonymous: false })}
                                                    />{' '}
                                                    公開
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="is_anonymous"
                                                        checked={data.poll.is_anonymous}
                                                        onChange={() => setData('poll', { ...data.poll, is_anonymous: true })}
                                                    />{' '}
                                                    匿名
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>選択肢 (最低2つ)</Label>
                                            <div className="mt-1 space-y-2">
                                                {data.poll.options.map((option, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <Input
                                                            type={data.poll.option_type === 'date' ? 'date' : 'text'}
                                                            value={option.value}
                                                            onChange={(e) => handlePollOptionChange(index, e.target.value)}
                                                            required
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removePollOption(index)}
                                                            disabled={data.poll.options.length <= 2}
                                                            className="h-8 w-8"
                                                        >
                                                            <X className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                            <InputError message={errors['poll.options']} className="mt-2" />
                                            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addPollOption}>
                                                選択肢を追加
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {data.type === 'board' && (
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
                                                <div className="text-sm text-muted-foreground">{attachments.length} ファイル</div>
                                            </div>

                                            <div className="mt-2 text-sm text-muted-foreground">
                                                使用可能なファイル形式: .png .jpg .jpeg .gif .pdf .txt .xlsx
                                            </div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                ファイルサイズは1ファイルあたり最大10MBまでです。
                                            </div>

                                            <div className="mt-3 flex items-start gap-3">
                                                {previews.map((p, idx) => (
                                                    <div key={idx} className="relative h-20 w-36 overflow-hidden rounded bg-gray-50 p-2">
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
                                                            <div className="flex h-full w-full flex-col items-start justify-center text-xs">
                                                                <div className="break-words">{p.file.name}</div>
                                                                <div className="mt-1 text-xs text-gray-500">{formatBytes(p.file.size)}</div>
                                                            </div>
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

                                            {serverErrors.attachments && (
                                                <InputError message={serverErrors.attachments.join(', ')} className="mt-2" />
                                            )}
                                        </div>
                                    </>
                                )}

                                {(data.type === 'manual' || data.type === 'poll') && (
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

                            <CardFooter className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">&nbsp;</div>
                                <div className="flex justify-end gap-4">
                                    <Link href={route('posts.index')}>
                                        <Button variant="outline" type="button">
                                            キャンセル
                                        </Button>
                                    </Link>
                                    <Button type="submit" disabled={processing || submitting}>
                                        {processing || submitting ? '投稿中...' : '投稿する'}
                                    </Button>
                                </div>
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
