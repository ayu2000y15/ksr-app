import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import ImageModal from '@/components/posts/image-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight, Edit, Plus, Trash, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

// ...existing code...

const breadcrumbs: BreadcrumbItem[] = [{ title: '日報', href: route('daily_reports.index') }];

export default function DailyReportsIndex() {
    type Preview = {
        url: string;
        isImage: boolean;
        existing?: boolean;
        file?: File;
        original_name?: string | null;
        size?: number | null;
        id?: number;
    };
    type Report = { id?: number; title?: string; date?: string; body?: string; [key: string]: unknown };

    const [reports, setReports] = useState<Report[]>([]);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    // form state
    const [showForm, setShowForm] = useState(false);
    const todayStr = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    })();
    const [date, setDate] = useState<string>(todayStr);
    const [title, setTitle] = useState<string>('');
    const [body, setBody] = useState<string>('');
    const [isPublic, setIsPublic] = useState<boolean>(false);
    const [tags, setTags] = useState<string>('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [previews, setPreviews] = useState<Preview[]>([]);
    const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [imageModalImages, setImageModalImages] = useState<string[]>([]);
    const [imageModalStartIndex, setImageModalStartIndex] = useState(0);
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
    // inline edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState<string>('');
    const [editBody, setEditBody] = useState<string>('');
    const [editIsPublic, setEditIsPublic] = useState<boolean>(false);
    const [editTags, setEditTags] = useState<string>('');
    const [editAttachments, setEditAttachments] = useState<File[]>([]);
    const [editPreviews, setEditPreviews] = useState<Preview[]>([]);
    const [editDeletedAttachmentIds, setEditDeletedAttachmentIds] = useState<number[]>([]);
    const editFileInputRef = useRef<HTMLInputElement | null>(null);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    // active tag filter
    const [activeTag, setActiveTag] = useState<string | null>(null);

    const toggleTag = (tag: string) => {
        setActiveTag((prev) => (prev === tag ? null : tag));
    };

    type PageProps = { auth?: { user?: { id?: number } } };
    const pageProps = usePage().props as PageProps;
    const currentUserId = pageProps?.auth?.user?.id ?? null;

    const extractDateKey = (raw?: string) => {
        if (!raw) return '';
        const s = raw.toString();
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        // fallback: try split by space or T
        return s.split(' ')[0].split('T')[0];
    };

    const formatCreatedAt = (raw?: string) => {
        if (!raw) return '';
        const s = raw.toString();
        const d = new Date(s);
        if (isNaN(d.getTime())) return s;
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const hh = String(d.getHours());
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${month}/${day} ${hh}:${mi}`;
    };

    const gotoPrevMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    const gotoNextMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

    const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    const load = async (url = '/api/daily-reports') => {
        try {
            const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error('Failed');
            const payload = await res.json();
            console.log('[daily-reports] api payload:', payload);
            const list = payload.data || payload;
            // keep server-provided date format as-is; do not mutate r.date
            console.log('[daily-reports] raw reports:', list);
            setReports((list || []).sort((a: Report, b: Report) => ((b.date as string) || '').localeCompare((a.date as string) || '')));
            setNextPageUrl(payload.next_page_url || null);
        } catch (e) {
            console.error(e);
        }
    };

    // load reports once on mount
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setPreviews((prev) => {
            prev.forEach((p) => {
                try {
                    if (!p.existing && p.url) URL.revokeObjectURL(p.url);
                } catch (err) {
                    console.debug(err);
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
        return () => {};
    }, [attachments]);

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
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
        if (oversizeNames.length > 0) msgs.push(`ファイルが大きすぎます: ${oversizeNames.join(', ')}`);
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

    const removePreviewAt = (idx: number) => {
        const p = previews[idx];
        if (p && !p.existing && p.url) {
            try {
                URL.revokeObjectURL(p.url);
            } catch (e) {
                console.debug(e);
            }
        }
        if (!p?.existing && p?.file) {
            setAttachments((prev) => prev.filter((f) => f !== p.file));
        }
        setPreviews((prev) => prev.filter((_, i) => i !== idx));
    };

    const startEdit = (r: Report) => {
        setEditingId((r.id as number) || null);
        setEditTitle((r.title as string) || '');
        setEditBody((r.body as string) || '');
        setEditIsPublic(!!(r.is_public as boolean));
        if (Array.isArray(r.tags)) {
            const names = (r.tags as Array<unknown>).map((t) => {
                if (typeof t === 'object' && t !== null && 'name' in (t as Record<string, unknown>)) {
                    return String((t as Record<string, unknown>).name || '');
                }
                return String(t || '');
            });
            setEditTags(names.join(','));
        } else {
            setEditTags((r.tags as string) || '');
        }
        // attachments: if existing attachments exist, show as existing previews
        const att = Array.isArray(r.attachments) ? r.attachments : [];
        const p = att
            .map((a: unknown) => {
                const aa = a as Record<string, unknown>;
                let url = (aa.file_path as string) || (aa.url as string) || (aa.path as string) || (aa.src as string) || '';
                if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/')) {
                    url = '/storage/' + url;
                }
                return { url, isImage: true, existing: true, original_name: (aa.original_name as string) || null, id: aa.id } as Preview;
            })
            .filter((x: Preview) => !!x.url);
        setEditPreviews(p);
        setEditDeletedAttachmentIds([]);
        setEditAttachments([]);
    };

    const cancelEdit = () => {
        // revoke created object URLs
        editPreviews.forEach((p) => {
            try {
                if (!p.existing && p.url) URL.revokeObjectURL(p.url);
            } catch (e) {
                console.debug(e);
            }
        });
        setEditingId(null);
        setEditTitle('');
        setEditBody('');
        setEditIsPublic(false);
        setEditTags('');
        setEditAttachments([]);
        setEditPreviews([]);
        setEditDeletedAttachmentIds([]);
        if (editFileInputRef.current) editFileInputRef.current.value = '';
    };

    function handleEditFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        const existingNames = new Set(editAttachments.map((f) => f.name));
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
        if (dupNames.length > 0 || invalidNames.length > 0 || oversizeNames.length > 0) {
            const msgs: string[] = [];
            if (dupNames.length > 0) msgs.push(`同名のファイルは既に選択されています: ${dupNames.join(', ')}`);
            if (invalidNames.length > 0) msgs.push(`使用できないファイル形式です: ${invalidNames.join(', ')}`);
            if (oversizeNames.length > 0) msgs.push(`ファイルが大きすぎます: ${oversizeNames.join(', ')}`);
            setServerErrors((prev) => ({ ...prev, attachments: msgs }));
        } else {
            setServerErrors((s) => {
                const copy = { ...s } as Record<string, string[]>;
                delete copy.attachments;
                return copy;
            });
        }
        if (toAdd.length > 0) {
            setEditAttachments((prev) => [...prev, ...toAdd]);
            const newPreviews = toAdd.map((f) => ({ url: URL.createObjectURL(f), file: f, isImage: f.type.startsWith('image/'), existing: false }));
            setEditPreviews((prev) => [...prev, ...newPreviews]);
        }
    }

    const removeEditPreviewAt = (idx: number) => {
        const p = editPreviews[idx];
        if (p && !p.existing && p.url) {
            try {
                URL.revokeObjectURL(p.url);
            } catch (e) {
                console.debug(e);
            }
        }
        if (!p?.existing && p?.file) {
            setEditAttachments((prev) => prev.filter((f) => f !== p.file));
        }
        // if preview referred to an existing attachment record, mark it for deletion
        if (p?.existing && p?.id) {
            setEditDeletedAttachmentIds((prev) => [...prev, p.id as number]);
        }
        setEditPreviews((prev) => prev.filter((_, i) => i !== idx));
    };

    const saveEdit = async (id: number) => {
        setServerErrors({});
        if (!editTitle || !editBody) {
            alert('タイトルと本文は必須です');
            return;
        }
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const fd = new FormData();
            fd.append('title', editTitle);
            fd.append('body', editBody);
            fd.append('is_public', editIsPublic ? '1' : '0');
            fd.append('tags', editTags);
            (editAttachments || []).forEach((f) => fd.append('attachments[]', f));
            // include ids of existing attachments the user removed during edit
            (editDeletedAttachmentIds || []).forEach((aid) => fd.append('deleted_attachment_ids[]', String(aid)));
            const res = await fetch(`/api/daily-reports/${id}`, {
                method: 'POST', // using POST with _method=PUT for older backends if needed
                body: fd,
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, 'X-HTTP-Method-Override': 'POST' },
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                if (json && json.errors) setServerErrors(json.errors);
                throw new Error('更新に失敗しました');
            }
            const updated = await res.json();
            setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
            setToast({
                message: updated && (updated.message || updated.title) ? updated.message || '更新しました' : '更新しました',
                type: 'success',
            });
            setTimeout(() => setToast(null), 3000);
            cancelEdit();
        } catch (err) {
            console.error(err);
            setToast({ message: '保存に失敗しました', type: 'error' });
            setTimeout(() => setToast(null), 4000);
        }
    };

    const submitForm = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setServerErrors({});
        if (!date || !title || !body) {
            alert('日付・タイトル・本文は必須です');
            return;
        }
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const fd = new FormData();
            fd.append('date', date);
            fd.append('title', title);
            fd.append('body', body);
            fd.append('is_public', isPublic ? '1' : '0');
            fd.append('tags', tags);
            (attachments || []).forEach((f) => fd.append('attachments[]', f));
            const res = await fetch('/api/daily-reports', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token },
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                if (json && json.errors) setServerErrors(json.errors);
                throw new Error('作成に失敗しました');
            }
            const created = await res.json();
            setReports((p) => [created, ...p]);
            // reset form
            setShowForm(false);
            setDate(todayStr);
            setTitle('');
            setBody('');
            setIsPublic(false);
            setTags('');
            setAttachments([]);
            setPreviews([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            console.error(err);
            alert('保存に失敗しました');
        }
    };

    const onDelete = async (id: number) => {
        if (!confirm('日報を削除します。よろしいですか？')) return;
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(`/api/daily-reports/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('failed');
            setReports((p) => p.filter((r) => r.id !== id));
        } catch (e) {
            console.error(e);
            alert('削除に失敗しました');
        }
    };

    // グループ化された日報データと、カレンダー表示用の日付リストをメモ化
    const { groupedReports, calendarDays } = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const date = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return {
                date: dateStr,
                day: day,
                weekday: date.toLocaleDateString('ja-JP', { weekday: 'short' }),
            };
        });

        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        // apply activeTag client-side filter
        const filteredReports = activeTag
            ? reports.filter((r) => {
                  const t = r.tags;
                  if (!t) return false;
                  if (Array.isArray(t)) {
                      return (t as Array<unknown>).some((x) => {
                          if (!x) return false;
                          if (typeof x === 'object' && x !== null && 'name' in (x as Record<string, unknown>)) {
                              const name = ((x as Record<string, unknown>).name || '').toString();
                              return name === activeTag;
                          }
                          return x.toString() === activeTag;
                      });
                  }
                  return t
                      .toString()
                      .split(/[,，\s]+/)
                      .some((n: string) => n === activeTag);
              })
            : reports;

        const grouped = filteredReports.reduce(
            (acc: Record<string, Report[]>, r: Report) => {
                const d = (r.date as string) || '';
                const key = extractDateKey(d);
                if (key.startsWith(monthPrefix)) {
                    acc[key] = acc[key] || [];
                    acc[key].push(r);
                }
                return acc;
            },
            {} as Record<string, Report[]>,
        );

        // debug: show calendar days and grouped map in console
        // (visible in browser devtools when this component renders)
        // avoid heavy logs in production but useful for debugging
        console.log('[daily-reports] calendarDays:', daysArray);
        console.log('[daily-reports] groupedReports sample keys:', Object.keys(grouped).slice(0, 10));

        return { groupedReports: grouped, calendarDays: daysArray };
    }, [reports, currentMonth, activeTag]);

    const loadMore = () => {
        if (!nextPageUrl) return;
        load(nextPageUrl);
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="日次ログ" />
            <div className="p-4 sm:p-6 lg:p-8">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                <div className="mb-6">
                    <HeadingSmall title="日次ログ" description="日次ログの一覧と作成" />
                    <div className="mt-4 flex justify-end">
                        <Button onClick={() => setShowForm((s) => !s)}>
                            <Plus className="mr-0 h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">新規登録</span>
                        </Button>
                    </div>
                </div>

                {showForm && (
                    <div className="mb-6 flex justify-center">
                        <div className="w-full lg:w-2/3">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle>新規日次ログ作成</CardTitle>
                                        <Button variant="ghost" className="p-1" onClick={() => setShowForm(false)} aria-label="閉じる">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={submitForm} className="space-y-4">
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
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            <div>
                                                <Label>日付</Label>
                                                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                                                <InputError message={serverErrors.date?.join(', ')} className="mt-2" />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <Label>タイトル</Label>
                                                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                                                <InputError message={serverErrors.title?.join(', ')} className="mt-2" />
                                            </div>
                                        </div>
                                        <div>
                                            <Label>本文</Label>
                                            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
                                            <InputError message={serverErrors.body?.join(', ')} className="mt-2" />
                                        </div>
                                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                                            <div>
                                                <Label>公開設定</Label>
                                                <select
                                                    className="mt-1 block w-full rounded border px-2 py-1"
                                                    value={isPublic ? 'public' : 'draft'}
                                                    onChange={(e) => setIsPublic(e.target.value === 'public')}
                                                >
                                                    <option value="draft">下書き</option>
                                                    <option value="public">公開</option>
                                                </select>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <Label>タグ (カンマ区切り)</Label>
                                                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1,tag2" />
                                            </div>
                                        </div>
                                        <div>
                                            <Label>画像添付</Label>
                                            <div className="mt-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        ref={fileInputRef}
                                                        id="daily_attachments"
                                                        className="hidden"
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        onChange={handleFile}
                                                    />
                                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                        ファイル選択
                                                    </Button>
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground">
                                                    最大 {MAX_FILE_SIZE / (1024 * 1024)}MB / 複数可
                                                </div>
                                            </div>
                                            {serverErrors.attachments && (
                                                <div className="mt-2 text-sm text-destructive">{serverErrors.attachments.join(', ')}</div>
                                            )}
                                            {previews.length > 0 && (
                                                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                    {previews.map((p, idx) => (
                                                        <div key={idx} className="relative overflow-hidden rounded border">
                                                            {p.isImage ? (
                                                                <img
                                                                    src={p.url}
                                                                    alt="preview"
                                                                    className="h-28 w-full cursor-pointer object-cover"
                                                                    onClick={() => {
                                                                        const imgs = previews.filter((pp) => pp.isImage).map((pp) => pp.url);
                                                                        const indexInImgs = imgs.findIndex((u) => u === p.url);
                                                                        setImageModalImages(imgs);
                                                                        setImageModalStartIndex(indexInImgs >= 0 ? indexInImgs : 0);
                                                                        setImageModalOpen(true);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="p-2">{p.original_name || 'ファイル'}</div>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => removePreviewAt(idx)}
                                                                className="absolute top-1 right-1 rounded-full bg-white p-1"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="outline" onClick={() => setShowForm(false)}>
                                                キャンセル
                                            </Button>
                                            <Button type="submit">保存</Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button size="sm" onClick={gotoPrevMonth} aria-label="前月">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="text-lg font-semibold">
                                    {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                                </div>
                                <Button size="sm" onClick={gotoNextMonth} aria-label="次月">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                {activeTag && (
                                    <div className="ml-4 flex items-center gap-2">
                                        <div className="rounded border border-orange-300 bg-orange-50 px-2 py-0.5 text-sm text-orange-800">
                                            タグ検索: {activeTag}
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => setActiveTag(null)}>
                                            解除
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border-t">
                            {calendarDays.map((day) => {
                                const items = groupedReports[day.date] || [];
                                const publicCount = items.filter((it) => (it.is_public as boolean) === true).length;
                                const draftVisibleCount = items.filter((it) => {
                                    if ((it.is_public as boolean) === true) return false;
                                    const ownerId = (it.user && (it.user as { id?: number }).id) ?? (it.user_id as number | undefined);
                                    return ownerId === currentUserId;
                                }).length;
                                const visibleCount = publicCount + draftVisibleCount;
                                const hasItems = visibleCount > 0;
                                const isOpen = !!expandedDays[day.date];

                                return (
                                    <div key={day.date} className="border-b">
                                        <button
                                            type="button"
                                            disabled={!hasItems}
                                            onClick={() => {
                                                if (hasItems) {
                                                    setExpandedDays((prev) => ({ ...prev, [day.date]: !prev[day.date] }));
                                                }
                                            }}
                                            className="flex w-full items-center justify-between p-4 text-left disabled:cursor-not-allowed"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="text-lg font-bold">{day.day}</div>
                                                <div className="text-sm">{day.weekday}</div>
                                                {publicCount > 0 && (
                                                    <div className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{publicCount}件</div>
                                                )}
                                                {draftVisibleCount > 0 && (
                                                    <div className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                                                        下書き{draftVisibleCount}件
                                                    </div>
                                                )}
                                            </div>
                                            {hasItems && (
                                                <ChevronDown
                                                    className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                />
                                            )}
                                        </button>

                                        {isOpen && hasItems && (
                                            <div className="bg-slate-50 p-4 pt-0">
                                                <div className="grid grid-cols-1 gap-4 rounded-b-lg border-t pt-4 sm:grid-cols-2">
                                                    {items
                                                        .filter((it) => {
                                                            // show if public
                                                            if ((it.is_public as boolean) === true) return true;
                                                            // otherwise show only to owner
                                                            const ownerId =
                                                                (it.user && (it.user as { id?: number }).id) ?? (it.user_id as number | undefined);
                                                            return ownerId === currentUserId;
                                                        })
                                                        .map((it) => (
                                                            <div key={it.id} className="rounded-lg border bg-white p-3 shadow-sm">
                                                                <div className="min-h-[80px] rounded bg-blue-100 p-2 shadow-inner">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="text-sm text-muted-foreground">
                                                                            {formatCreatedAt((it.created_at as string) || (it.date as string))}
                                                                        </div>
                                                                        {!(it.is_public as boolean) && (
                                                                            <div className="rounded bg-yellow-200 px-2 py-0.5 text-xs">下書き</div>
                                                                        )}
                                                                    </div>
                                                                    {editingId === it.id ? (
                                                                        <div className="space-y-2">
                                                                            <div>
                                                                                <Label>タイトル</Label>
                                                                                <Input
                                                                                    value={editTitle}
                                                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    {((it.user && (it.user as { name?: string }).name) as string) ||
                                                                                        (it.user_name as string) ||
                                                                                        ''}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <Label>本文</Label>
                                                                                <Textarea
                                                                                    rows={4}
                                                                                    value={editBody}
                                                                                    onChange={(e) => setEditBody(e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                                <div>
                                                                                    <Label>公開設定</Label>
                                                                                    <select
                                                                                        className="mt-1 block w-full rounded border px-2 py-1"
                                                                                        value={editIsPublic ? 'public' : 'draft'}
                                                                                        onChange={(e) => setEditIsPublic(e.target.value === 'public')}
                                                                                    >
                                                                                        <option value="draft">下書き</option>
                                                                                        <option value="public">公開</option>
                                                                                    </select>
                                                                                </div>
                                                                                <div>
                                                                                    <Label>タグ (カンマ区切り)</Label>
                                                                                    <Input
                                                                                        value={editTags}
                                                                                        onChange={(e) => setEditTags(e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <Label>画像添付</Label>
                                                                                <input
                                                                                    ref={editFileInputRef}
                                                                                    className="hidden"
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    multiple
                                                                                    onChange={handleEditFile}
                                                                                />
                                                                                <div className="mt-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="outline"
                                                                                            onClick={() => editFileInputRef.current?.click()}
                                                                                        >
                                                                                            ファイル選択
                                                                                        </Button>
                                                                                    </div>
                                                                                    <div className="mt-1 text-sm text-muted-foreground">
                                                                                        最大 {MAX_FILE_SIZE / (1024 * 1024)}MB / 複数可
                                                                                    </div>
                                                                                </div>
                                                                                {editPreviews.length > 0 && (
                                                                                    <div className="mt-3 grid grid-cols-3 gap-3">
                                                                                        {editPreviews.map((p, idx) => (
                                                                                            <div
                                                                                                key={idx}
                                                                                                className="relative overflow-hidden rounded border"
                                                                                            >
                                                                                                {p.isImage ? (
                                                                                                    <img
                                                                                                        src={p.url}
                                                                                                        alt="preview"
                                                                                                        className="h-20 w-full object-cover"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="p-2">
                                                                                                        {p.original_name || 'ファイル'}
                                                                                                    </div>
                                                                                                )}
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => removeEditPreviewAt(idx)}
                                                                                                    className="absolute top-1 right-1 rounded-full bg-white p-1"
                                                                                                >
                                                                                                    <X className="h-4 w-4" />
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-end gap-2">
                                                                                <Button variant="outline" onClick={cancelEdit}>
                                                                                    キャンセル
                                                                                </Button>
                                                                                <Button onClick={() => saveEdit(it.id as number)}>保存</Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <div className="mt-1 font-semibold">{it.title || '(無題)'}</div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {((it.user && (it.user as { name?: string }).name) as string) ||
                                                                                    (it.user_name as string) ||
                                                                                    ''}
                                                                            </div>
                                                                            <div className="mt-2 text-sm whitespace-pre-wrap">{it.body || ''}</div>
                                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                                {Array.isArray(it.tags) && it.tags.length > 0
                                                                                    ? (it.tags as Array<{ id?: number; name?: string }>).map((t) => {
                                                                                          const name = (t.name || String(t)) as string;
                                                                                          const isActive = activeTag === name;
                                                                                          return (
                                                                                              <button
                                                                                                  key={t.id || name}
                                                                                                  type="button"
                                                                                                  onClick={() => toggleTag(name)}
                                                                                                  className={`ml-0 inline-flex items-center rounded border px-2 py-0.5 text-xs ${
                                                                                                      isActive
                                                                                                          ? 'border-orange-500 bg-orange-100 text-orange-900'
                                                                                                          : 'border-orange-200 bg-orange-50 text-orange-800'
                                                                                                  }`}
                                                                                              >
                                                                                                  {name}
                                                                                              </button>
                                                                                          );
                                                                                      })
                                                                                    : typeof it.tags === 'string' && it.tags.trim() !== ''
                                                                                      ? it.tags.split(/[,，\s]+/).map((n: string) => {
                                                                                            const name = n;
                                                                                            const isActive = activeTag === name;
                                                                                            return (
                                                                                                <button
                                                                                                    key={n}
                                                                                                    type="button"
                                                                                                    onClick={() => toggleTag(name)}
                                                                                                    className={`ml-0 inline-flex items-center rounded border px-2 py-0.5 text-xs ${
                                                                                                        isActive
                                                                                                            ? 'border-orange-500 bg-orange-100 text-orange-900'
                                                                                                            : 'border-orange-200 bg-orange-50 text-orange-800'
                                                                                                    }`}
                                                                                                >
                                                                                                    {n}
                                                                                                </button>
                                                                                            );
                                                                                        })
                                                                                      : null}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 flex items-center justify-between">
                                                                    <div>
                                                                        {/* show Detail button only if attachments present */}
                                                                        {Array.isArray(it.attachments) &&
                                                                            it.attachments.length > 0 &&
                                                                            (() => {
                                                                                const attachmentsArr = Array.isArray(it.attachments)
                                                                                    ? it.attachments
                                                                                    : [];
                                                                                const imgs = attachmentsArr
                                                                                    .map(
                                                                                        (a: {
                                                                                            file_path?: string;
                                                                                            url?: string;
                                                                                            path?: string;
                                                                                            src?: string;
                                                                                        }) => {
                                                                                            let url = a.file_path || a.url || a.path || a.src || '';
                                                                                            if (
                                                                                                url &&
                                                                                                typeof url === 'string' &&
                                                                                                !url.match(/^https?:\/\//) &&
                                                                                                !url.startsWith('/')
                                                                                            ) {
                                                                                                url = '/storage/' + url;
                                                                                            }
                                                                                            return url;
                                                                                        },
                                                                                    )
                                                                                    .filter((u: string) => !!u);
                                                                                if (imgs.length === 0) return null;
                                                                                // show first image preview; clicking opens modal with all images
                                                                                return (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="overflow-hidden rounded border bg-white p-0"
                                                                                        onClick={() => {
                                                                                            setImageModalImages(imgs as string[]);
                                                                                            setImageModalStartIndex(0);
                                                                                            setImageModalOpen(true);
                                                                                        }}
                                                                                        aria-label="画像を表示"
                                                                                    >
                                                                                        <img
                                                                                            src={imgs[0]}
                                                                                            alt="添付プレビュー"
                                                                                            className="h-10 w-15 object-cover"
                                                                                        />
                                                                                    </button>
                                                                                );
                                                                            })()}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => startEdit(it)}
                                                                            aria-label="編集"
                                                                        >
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="destructive"
                                                                            onClick={() => it.id && onDelete(it.id as number)}
                                                                            aria-label="削除"
                                                                        >
                                                                            <Trash className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {nextPageUrl && (
                            <div className="mt-6 text-center">
                                <Button onClick={loadMore} variant="outline">
                                    もっとみる
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
                {imageModalOpen && (
                    <ImageModal images={imageModalImages} startIndex={imageModalStartIndex} onClose={() => setImageModalOpen(false)} />
                )}
            </div>
        </AppSidebarLayout>
    );
}
