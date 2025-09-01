import HeadingSmall from '@/components/heading-small';
import ImageModal from '@/components/posts/image-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Edit, MessageSquare, MoreVertical, Paperclip, Send, Trash2, Undo2, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

// --- 型定義 ---
type Attachment = {
    id?: number;
    file_path?: string;
    url?: string;
    path?: string;
    src?: string;
    original_name?: string;
};
type Comment = {
    id?: number;
    body?: string;
    user?: { id?: number; name?: string } | null;
    user_id?: number;
    created_at?: string;
    quote?: Comment | null;
    quote_comment_id?: number | null;
};
type Note = {
    id?: number;
    date?: string;
    user?: { id?: number; name?: string } | null;
    user_id?: number;
    user_name?: string;
    body?: string;
    attachments?: Attachment[];
    comments?: Comment[];
    created_at?: string;
};

const breadcrumbs = [{ title: '日次ノート', href: route('daily_notes.index') }];

// 時刻表示ヘルパ: 24時間以内は相対表示（分前/時間前）、それ以降は 'yyyy/mm/dd hh:mi' を返す
function formatRelativeTime(raw?: string) {
    if (!raw) return '';
    const d = new Date(raw);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000); // seconds
    if (diff < 60) return 'たった今';
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- メインコンポーネント ---
export default function DailyNotesIndex() {
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [notes, setNotes] = useState<Note[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
    const pageProps = usePage().props as { auth?: { user?: { id?: number } } };
    const currentUserId = pageProps?.auth?.user?.id ?? null;

    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

    const gotoPrev = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    const gotoNext = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

    const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch(`/api/daily-notes?month=${monthStr}`, { credentials: 'same-origin' });
                if (!res.ok) throw new Error('failed');
                const json = await res.json();
                if (mounted) setNotes(json.notes || []);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [monthStr]);

    // fetch holidays for the current month from API (same format as shifts calendar)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const monthParam = `${monthStr}-01`;
                const res = await fetch(`/api/holidays?month=${encodeURIComponent(monthParam)}`, { credentials: 'same-origin' });
                if (!res.ok) throw new Error('failed');
                const json = await res.json();
                // normalize to YYYY-MM-DD
                const list: string[] = (json.holidays || []).map((h: unknown) => {
                    const obj = h as { date?: string } | string;
                    const s = typeof obj === 'string' ? obj : obj.date || '';
                    return String(s).substr(0, 10);
                });
                if (mounted) setHolidays(list);
            } catch (e) {
                console.error(e);
                if (mounted) setHolidays([]);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [monthStr]);

    const selectDay = React.useCallback(
        (d: number) => {
            const date = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            setSelectedDate(date);
        },
        [currentMonth],
    );

    useEffect(() => {
        const today = new Date();
        if (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth()) {
            selectDay(today.getDate());
        }
    }, [currentMonth, selectDay]);

    const grouped = useMemo(() => {
        const map: Record<string, Note[]> = {};
        notes.forEach((n) => {
            const key = (n.date || '').toString();
            map[key] = map[key] || [];
            map[key].push(n);
        });
        // 各日付グループ内で作成日時順にソート
        for (const key in map) {
            map[key].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        }
        return map;
    }, [notes]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleCreate = async (body: string, attachments: File[]): Promise<boolean> => {
        if (!selectedDate) {
            showToast('日付を選択してください', 'error');
            return false;
        }
        if (!body) {
            showToast('本文を入力してください', 'error');
            return false;
        }
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const fd = new FormData();
            fd.append('date', selectedDate);
            fd.append('body', body);
            attachments.forEach((f) => fd.append('attachments[]', f));
            const res = await fetch('/api/daily-notes', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-TOKEN': token } });
            if (!res.ok) throw new Error('failed');
            const json = await res.json();
            setNotes((p) => [...p, json]);
            showToast('保存しました');
            return true;
        } catch (e) {
            console.error(e);
            showToast('保存に失敗しました', 'error');
            return false;
        }
    };

    const handleUpdate = async (noteId: number, body: string, newAttachments: File[], deletedAttachmentIds: number[]): Promise<void> => {
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const fd = new FormData();
            fd.append('body', body);
            newAttachments.forEach((f) => fd.append('attachments[]', f));
            deletedAttachmentIds.forEach((id) => fd.append('deleted_attachment_ids[]', String(id)));
            const res = await fetch(`/api/daily-notes/${noteId}`, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('failed');
            const json = await res.json();
            setNotes((prev) => prev.map((n) => (n.id === json.id ? json : n)));
            showToast('更新しました');
            setEditingNoteId(null);
        } catch (e) {
            console.error(e);
            showToast('更新に失敗しました', 'error');
        }
    };

    const handleDelete = async (noteId: number): Promise<void> => {
        if (!confirm('本当に削除しますか？')) return;
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(`/api/daily-notes/${noteId}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token },
            });
            if (res.ok) {
                setNotes((p) => p.filter((x) => x.id !== noteId));
                showToast('削除しました');
            } else {
                throw new Error('failed');
            }
        } catch (e) {
            console.error(e);
            showToast('削除に失敗しました', 'error');
        }
    };

    const handleCommentAction = async (url: string, method: 'POST' | 'DELETE', body?: FormData) => {
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(url, {
                method,
                body,
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('failed');

            if (method === 'POST') {
                const json = await res.json();
                const dailyNoteId = body?.get('daily_note_id');
                setNotes((prev) => prev.map((n) => (n.id === Number(dailyNoteId) ? { ...n, comments: [...(n.comments || []), json] } : n)));
            } else {
                const commentId = Number(url.split('/').pop());
                setNotes((prev) => prev.map((n) => ({ ...n, comments: (n.comments || []).filter((c: Comment) => c.id !== commentId) })));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const addComment = (dailyNoteId: number, body: string, quoteId?: number) => {
        const fd = new FormData();
        fd.append('daily_note_id', String(dailyNoteId));
        fd.append('body', body);
        if (quoteId) fd.append('quote_comment_id', String(quoteId));
        handleCommentAction('/api/daily-note-comments', 'POST', fd);
    };

    const deleteComment = (commentId: number) => {
        if (!confirm('コメントを削除しますか？')) return;
        handleCommentAction(`/api/daily-note-comments/${commentId}`, 'DELETE');
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="日次ノート" />
            <div className="p-4 sm:p-6 lg:p-8">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                <div className="mb-6">
                    <HeadingSmall title="日次ノート" description="その日の出来事、作業ログなどを記載すること" />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
                    <div className="col-span-1">
                        <CalendarView
                            currentMonth={currentMonth}
                            selectedDate={selectedDate}
                            groupedNotes={grouped}
                            holidays={holidays}
                            onDateSelect={selectDay}
                            onPrev={gotoPrev}
                            onNext={gotoNext}
                        />
                    </div>
                    <div className="col-span-2">
                        <NoteSheet
                            key={selectedDate}
                            selectedDate={selectedDate}
                            notes={grouped[selectedDate] || []}
                            currentUserId={currentUserId}
                            editingNoteId={editingNoteId}
                            onStartEdit={(id: number) => setEditingNoteId(id)}
                            onCancelEdit={() => setEditingNoteId(null)}
                            onNoteCreate={handleCreate}
                            onNoteUpdate={handleUpdate}
                            onNoteDelete={handleDelete}
                            onCommentAdd={addComment}
                            onCommentDelete={deleteComment}
                        />
                    </div>
                </div>
            </div>
        </AppSidebarLayout>
    );
}

// --- カレンダーコンポーネント ---
function CalendarView({
    currentMonth,
    selectedDate,
    groupedNotes,
    onDateSelect,
    onPrev,
    onNext,
    holidays,
}: {
    currentMonth: Date;
    selectedDate: string;
    groupedNotes: Record<string, Note[]>;
    onDateSelect: (day: number) => void;
    holidays?: string[];
    onPrev?: () => void;
    onNext?: () => void;
}) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonthRaw = new Date(year, month, 1).getDay();
    // Monday-first: compute leading empty slots (Mon=0..Sun=6)
    const leadingEmpty = (firstDayOfMonthRaw + 6) % 7;

    const weekdays = ['月', '火', '水', '木', '金', '土', '日'];

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <CardTitle>カレンダー</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={onPrev} aria-label="前の月">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-sm font-medium">
                            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                        </div>
                        <Button size="sm" onClick={onNext} aria-label="次の月">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {weekdays.map((day, idx) => {
                        const headerBg = idx === 5 ? 'bg-blue-50 text-blue-600' : idx === 6 ? 'bg-red-50 text-red-600' : 'text-muted-foreground';
                        return (
                            <div key={day} className={`${headerBg} py-1`}>
                                {day}
                            </div>
                        );
                    })}
                </div>

                {/* column-oriented calendar body so we can color entire columns */}
                <div className="mt-2 flex gap-1">
                    {/* build weeks 2D array [weekIndex][colIndex] => day number | null */}
                    {(() => {
                        const totalSlots = leadingEmpty + daysInMonth;
                        const weeksCount = Math.ceil(totalSlots / 7);
                        const weeks: (number | null)[][] = Array.from({ length: weeksCount }, () => Array(7).fill(null));
                        let slot = 0;
                        for (let w = 0; w < weeksCount; w++) {
                            for (let c = 0; c < 7; c++) {
                                const globalIndex = w * 7 + c;
                                if (globalIndex >= leadingEmpty && slot < daysInMonth) {
                                    weeks[w][c] = slot + 1;
                                    slot++;
                                } else {
                                    weeks[w][c] = null;
                                }
                            }
                        }
                        return (
                            // render 7 columns; each column is a vertical stack of week cells
                            Array.from({ length: 7 }).map((_, colIdx) => {
                                const colBgClass = colIdx === 5 ? 'bg-blue-50' : colIdx === 6 ? 'bg-red-50' : '';
                                const colTextClass = colIdx === 5 ? 'text-blue-800' : colIdx === 6 ? 'text-red-800' : '';

                                return (
                                    <div key={`col-${colIdx}`} className={`flex flex-1 flex-col gap-1 rounded-md p-0 ${colBgClass}`}>
                                        {weeks.map((week, wi) => {
                                            const day = week[colIdx];
                                            if (day == null) {
                                                return <div key={`empty-${wi}-${colIdx}`} className="h-10" />;
                                            }

                                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            const hasNotes = (groupedNotes[dateStr] || []).length > 0;
                                            const isSelected = selectedDate === dateStr;
                                            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
                                            const holidayFlag = Array.isArray(holidays) ? holidays.includes(dateStr) : false;

                                            // cell default is transparent so column background shows through; override for special states
                                            const baseCell = 'relative rounded-md p-2 text-sm font-medium transition-colors bg-transparent';
                                            // selection should override holiday styling — use Tailwind important utilities and raise z-index
                                            const overrideClass = isSelected
                                                ? '!bg-primary !text-primary-foreground z-10'
                                                : holidayFlag
                                                  ? 'bg-red-100 text-red-800'
                                                  : isToday
                                                    ? 'bg-muted'
                                                    : `${colTextClass}`;

                                            return (
                                                <button
                                                    key={`day-${wi}-${colIdx}`}
                                                    onClick={() => onDateSelect(day)}
                                                    className={`${baseCell} ${overrideClass}`}
                                                >
                                                    {day}
                                                    {hasNotes && <span className="absolute right-1 bottom-1 h-2 w-2 rounded-full bg-blue-500" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        );
                    })()}
                </div>
            </CardContent>
        </Card>
    );
}

// --- ノートシートコンポーネント ---
type NoteSheetProps = {
    selectedDate: string;
    notes: Note[];
    currentUserId: number | null;
    editingNoteId: number | null;
    onStartEdit: (id: number) => void;
    onCancelEdit: () => void;
    onNoteCreate: (body: string, attachments: File[]) => Promise<boolean>;
    onNoteUpdate: (noteId: number, body: string, newAttachments: File[], deletedAttachmentIds: number[]) => Promise<void> | void;
    onNoteDelete: (noteId: number) => void;
    onCommentAdd: (dailyNoteId: number, body: string, quoteId?: number) => void;
    onCommentDelete: (commentId: number) => void;
};

function NoteSheet({
    selectedDate,
    notes,
    currentUserId,
    editingNoteId,
    onStartEdit,
    onCancelEdit,
    onNoteCreate,
    onNoteUpdate,
    onNoteDelete,
    onCommentAdd,
    onCommentDelete,
}: NoteSheetProps) {
    if (!selectedDate) {
        return (
            <Card className="flex h-96 items-center justify-center">
                <div className="text-center text-muted-foreground">
                    <p>カレンダーから日付を選択してください。</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-xl font-bold">ノート: {selectedDate}</div>
            <div className="space-y-4">
                {notes.map((note: Note) => (
                    <div key={note.id}>
                        {editingNoteId === note.id ? (
                            <NoteEditor note={note} onSave={onNoteUpdate} onCancel={onCancelEdit} />
                        ) : (
                            <NoteItem
                                note={note}
                                currentUserId={currentUserId}
                                onStartEdit={() => onStartEdit(note.id!)}
                                onDelete={() => onNoteDelete(note.id!)}
                                onCommentAdd={onCommentAdd}
                                onCommentDelete={onCommentDelete}
                            />
                        )}
                    </div>
                ))}
            </div>
            <NewNoteForm onSubmit={onNoteCreate} />
        </div>
    );
}

// --- 各ノートの表示コンポーネント ---
type NoteItemProps = {
    note: Note;
    currentUserId: number | null;
    onStartEdit: () => void;
    onDelete: () => void;
    onCommentAdd: (dailyNoteId: number, body: string, quoteId?: number) => void;
    onCommentDelete: (commentId: number) => void;
};

function NoteItem({ note, currentUserId, onStartEdit, onDelete, onCommentAdd, onCommentDelete }: NoteItemProps) {
    const formatTime = (raw?: string) => (raw ? formatRelativeTime(raw) : '');
    const userName = note.user?.name || note.user_name || '不明';

    return (
        <div className="flex items-start gap-4 rounded-lg border bg-card p-4 text-card-foreground">
            <Avatar>
                <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userName)}`} />
                <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold">{userName}</span>
                        <span className="text-muted-foreground">{formatTime(note.created_at)}</span>
                    </div>
                    {note.user_id === currentUserId && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onStartEdit}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    編集
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    削除
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <div className="mt-2 text-sm whitespace-pre-wrap">{note.body}</div>

                {Array.isArray(note.attachments) && note.attachments.length > 0 && <NoteAttachments attachments={note.attachments} />}

                <div className="mt-4 border-t pt-3">
                    <CommentSection
                        noteId={note.id!}
                        comments={note.comments || []}
                        currentUserId={currentUserId}
                        onCommentAdd={onCommentAdd}
                        onCommentDelete={onCommentDelete}
                    />
                </div>
            </div>
        </div>
    );
}

function NoteAttachments({ attachments }: { attachments: Attachment[] }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [startIndex, setStartIndex] = useState(0);

    useEffect(() => {
        const imgs = (attachments || []).map((a) => {
            let url = a.file_path || a.url || a.path || a.src || '';
            if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/storage')) url = '/storage/' + url;
            return url;
        });
        setImages(imgs);
    }, [attachments]);

    const openAt = (i: number) => {
        setStartIndex(i);
        setModalOpen(true);
    };

    return (
        <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {images.map((src, i) => (
                    <button key={i} onClick={() => openAt(i)} className="h-28 overflow-hidden rounded-md border">
                        <img src={src} className="h-full w-full object-cover" alt={`attachment-${i}`} />
                    </button>
                ))}
            </div>
            {modalOpen && <ImageModal images={images} startIndex={startIndex} onClose={() => setModalOpen(false)} />}
        </>
    );
}

// --- 新規ノート作成フォーム ---
function NewNoteForm({ onSubmit }: { onSubmit: (body: string, attachments: File[]) => Promise<boolean> }) {
    const [body, setBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [startIndex, setStartIndex] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);
    const prevUrlsRef = useRef<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await onSubmit(body, attachments);
        if (success) {
            setBody('');
            setAttachments([]);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachments(files);
        // create object URLs for previews
        const urls = files.map((f) => URL.createObjectURL(f));
        // revoke previous
        prevUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        prevUrlsRef.current = urls;
        setPreviewUrls(urls);
    };

    useEffect(() => {
        return () => {
            // cleanup on unmount
            prevUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
            prevUrlsRef.current = [];
        };
    }, []);

    return (
        <Card className="mt-6">
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Textarea placeholder="新しいノートを追記..." value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
                    <div className="flex items-center justify-between">
                        <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()}>
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <Button type="submit" disabled={!body.trim()}>
                            <Send className="mr-2 h-4 w-4" />
                            投稿する
                        </Button>
                    </div>
                    <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                    {attachments.length > 0 && (
                        <div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                {previewUrls.map((src, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            setStartIndex(i);
                                            setModalOpen(true);
                                        }}
                                        className="h-28 overflow-hidden rounded-md border"
                                    >
                                        <img src={src} className="h-full w-full object-cover" alt={`new-attach-${i}`} />
                                    </button>
                                ))}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">{attachments.length}件のファイルが選択されています。</div>
                        </div>
                    )}
                    {modalOpen && <ImageModal images={previewUrls} startIndex={startIndex} onClose={() => setModalOpen(false)} />}
                </form>
            </CardContent>
        </Card>
    );
}

// --- ノート編集フォーム ---
type NoteEditorSaveFn = (noteId: number, body: string, newAttachments: File[], deletedAttachmentIds: number[]) => void;

function NoteEditor({ note, onSave, onCancel }: { note: Note; onSave: NoteEditorSaveFn; onCancel: () => void }) {
    const [body, setBody] = useState(note.body || '');
    const [newAttachments, setNewAttachments] = useState<File[]>([]);
    const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);
    const editFileRef = useRef<HTMLInputElement>(null);
    const prevNewUrlsRef = useRef<string[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [startIndex, setStartIndex] = useState(0);

    const toggleMarkDelete = (id: number) => {
        setDeletedAttachmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    useEffect(() => {
        return () => {
            prevNewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
            prevNewUrlsRef.current = [];
        };
    }, []);

    const handleNewFiles = (files: File[]) => {
        setNewAttachments(files);
        const urls = files.map((f) => URL.createObjectURL(f));
        // cleanup previous
        prevNewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        prevNewUrlsRef.current = urls;
        setNewPreviewUrls(urls);
    };

    const openModalAt = (index: number) => {
        setModalOpen(true);
        setStartIndex(index);
    };

    const buildModalImages = () => {
        // existing attachments that are not marked deleted
        const existing = (note.attachments || [])
            .filter((a) => !deletedAttachmentIds.includes(a.id!))
            .map((a) => {
                let url = a.file_path || a.url || a.path || a.src || '';
                if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/storage')) url = '/storage/' + url;
                return url;
            });
        return [...existing, ...newPreviewUrls];
    };

    return (
        <Card className="bg-muted/50 p-4">
            <div className="space-y-4">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />

                <div>
                    <div className="mb-2 text-sm font-medium">既存の添付ファイル</div>
                    {(note.attachments && note.attachments.length > 0) || newPreviewUrls.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                            {/* existing attachments (click to open modal) */}
                            {(note.attachments || []).map((a) => {
                                const isMarked = deletedAttachmentIds.includes(a.id!);
                                let url = a.file_path || a.url || a.path || a.src || '';
                                if (url && typeof url === 'string' && !url.match(/^https?:\/\//) && !url.startsWith('/storage'))
                                    url = '/storage/' + url;
                                return (
                                    <div key={`exist-${a.id}`} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // index is position among existing non-deleted before this one
                                                const existing = (note.attachments || []).filter((att) => !deletedAttachmentIds.includes(att.id!));
                                                const idx = existing.findIndex((att) => att.id === a.id);
                                                openModalAt(idx === -1 ? 0 : idx);
                                            }}
                                            className="h-28 w-full overflow-hidden rounded-md border"
                                        >
                                            <img
                                                src={url}
                                                className={`h-28 w-full object-cover ${isMarked ? 'opacity-40' : ''}`}
                                                alt={a.original_name || ''}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleMarkDelete(a.id!)}
                                            className="absolute top-1 right-1 rounded-full bg-background/70 p-1 text-xs"
                                        >
                                            {isMarked ? <Undo2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                        </button>
                                    </div>
                                );
                            })}

                            {/* new file previews */}
                            {newPreviewUrls.map((src, i) => (
                                <button
                                    key={`new-${i}`}
                                    type="button"
                                    onClick={() => {
                                        const idx = (note.attachments || []).filter((a) => !deletedAttachmentIds.includes(a.id!)).length + i;
                                        openModalAt(idx);
                                    }}
                                    className="h-28 overflow-hidden rounded-md border"
                                >
                                    <img src={src} className="h-full w-full object-cover" alt={`new-${i}`} />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">添付ファイルはありません。</p>
                    )}
                </div>

                <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => editFileRef.current?.click()}>
                        ファイルを追加
                    </Button>
                    <input
                        ref={editFileRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleNewFiles(Array.from(e.target.files || []))}
                    />
                    {newAttachments.length > 0 && (
                        <div className="mt-2 text-sm text-muted-foreground">{newAttachments.length}件の新しいファイル。</div>
                    )}
                </div>

                {/* Image modal for editor (existing + new) */}
                {modalOpen && <ImageModal images={buildModalImages()} startIndex={startIndex} onClose={() => setModalOpen(false)} />}

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onCancel()}>
                        キャンセル
                    </Button>
                    <Button onClick={() => onSave(note.id!, body, newAttachments, deletedAttachmentIds)}>保存する</Button>
                </div>
            </div>
        </Card>
    );
}

// --- コメントセクションコンポーネント ---
type CommentSectionProps = {
    noteId: number;
    comments: Comment[];
    currentUserId: number | null;
    onCommentAdd: (dailyNoteId: number, body: string, quoteId?: number) => void;
    onCommentDelete: (commentId: number) => void;
};

function CommentSection({ noteId, comments, currentUserId, onCommentAdd, onCommentDelete }: CommentSectionProps) {
    const [quote, setQuote] = useState<Comment | null>(null);
    const formatTime = (raw?: string) => (raw ? formatRelativeTime(raw) : '');

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>コメント</span>
            </div>
            <div className="space-y-2">
                {comments.map((c: Comment) => (
                    <div key={c.id} className="flex items-start gap-2 text-sm">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(c.user?.name || '')}`} />
                            <AvatarFallback className="text-xs">{(c.user?.name || '').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 rounded-md bg-muted/50 p-2">
                            <div className="flex items-center justify-between">
                                <div className="text-xs">
                                    <span className="font-semibold">{c.user?.name}</span>
                                    <span className="ml-2 text-muted-foreground">{formatTime(c.created_at)}</span>
                                </div>
                                {c.user_id === currentUserId && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCommentDelete(c.id!)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                            {c.quote && (
                                <div className="mt-1 border-l-2 pl-2 text-xs text-muted-foreground">
                                    <p className="truncate">
                                        @{c.quote.user?.name}: {c.quote.body}
                                    </p>
                                </div>
                            )}
                            <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                        </div>
                    </div>
                ))}
            </div>
            <CommentInput
                key={quote?.id} // 引用が変わったらリセット
                quote={quote}
                onClearQuote={() => setQuote(null)}
                onSubmit={(text, quoteId) => {
                    onCommentAdd(noteId, text, quoteId);
                }}
            />
        </div>
    );
}

// --- コメント入力コンポーネント ---
function CommentInput({
    quote,
    onClearQuote,
    onSubmit,
}: {
    quote: Comment | null;
    onClearQuote: () => void;
    onSubmit: (text: string, quoteId?: number) => void;
}) {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
        if (!text.trim()) return;
        onSubmit(text, quote?.id);
        setText('');
        onClearQuote();
    };

    return (
        <div className="pt-2">
            {quote && (
                <div className="flex items-center justify-between rounded-t-md bg-muted/50 p-1.5 text-xs text-muted-foreground">
                    <span>@{quote.user?.name}に返信中...</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClearQuote}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}
            <div className="flex items-start gap-2">
                <Textarea
                    ref={inputRef}
                    placeholder="コメントを追加..."
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className={`resize-none ${quote ? 'rounded-t-none' : ''}`}
                />
                <Button onClick={handleSubmit} disabled={!text.trim()}>
                    送信
                </Button>
            </div>
        </div>
    );
}
