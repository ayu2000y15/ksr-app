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
    tags?: Array<{ id?: number; name?: string }> | string;
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

// Return YYYY-MM-DD for given date in Japan Standard Time (UTC+9)
function toJstYmd(date: Date) {
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(jst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// convert URLs in text to clickable links while optionally preserving a highlight term
function renderWithLinks(text?: string, highlight?: string | null) {
    if (!text) return null;
    const urlRe = /(https?:\/\/[^\s]+)/g;

    if (!highlight) {
        const parts = text.split(urlRe);
        return (
            <>
                {parts.map((p, i) => {
                    if (urlRe.test(p)) {
                        urlRe.lastIndex = 0;
                        return (
                            <a
                                key={i}
                                href={p}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block max-w-[48ch] truncate text-sky-600 underline hover:text-sky-800"
                            >
                                {p}
                            </a>
                        );
                    }
                    return <span key={i}>{p}</span>;
                })}
            </>
        );
    }

    const urlParts = text.split(urlRe);
    return (
        <>
            {urlParts.map((part, idx) => {
                if (!part) return null;
                if (urlRe.test(part)) {
                    urlRe.lastIndex = 0;
                    return (
                        <a
                            key={`u-${idx}`}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block max-w-[48ch] truncate text-sky-600 underline hover:text-sky-800"
                        >
                            {part}
                        </a>
                    );
                }

                try {
                    const re = new RegExp(`(${String(highlight).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi');
                    const parts = part.split(re);
                    return (
                        <span key={`t-${idx}`}>
                            {parts.map((p, i) =>
                                re.test(p) ? (
                                    <mark key={i} className="bg-yellow-200 text-yellow-900">
                                        {p}
                                    </mark>
                                ) : (
                                    <span key={i}>{p}</span>
                                ),
                            )}
                        </span>
                    );
                } catch {
                    return <span key={`t-${idx}`}>{part}</span>;
                }
            })}
        </>
    );
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
    type PageProps = {
        auth?: { user?: { id?: number }; permissions?: string[] };
        permissions?: Record<string, Record<string, boolean>>;
    };

    const pageProps = usePage().props as PageProps;
    const currentUserId = pageProps?.auth?.user?.id ?? null;

    // helper to check permissions from either flat auth.permissions (string[])
    // or nested permissions object (e.g. { daily_note: { create: true } })
    const hasPermission = (perm: string) => {
        const flat = pageProps?.auth?.permissions;
        if (Array.isArray(flat) && flat.includes(perm)) return true;
        const nested = pageProps?.permissions;
        if (nested && typeof nested === 'object') {
            const [group, action] = perm.split('.');
            const typed = nested as Record<string, Record<string, boolean>>;
            if (typed[group] && typed[group][action]) return true;
        }
        return false;
    };

    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

    const gotoPrev = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    const gotoNext = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

    const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

    // search state (default: from 3 months ago to today)
    const formatYMD = (d: Date) => d.toISOString().slice(0, 10);
    // default search dates should use Japan Standard Time
    const todayStr = toJstYmd(new Date());
    const threeMonthsAgo = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = toJstYmd(threeMonthsAgo);

    const [searchQ, setSearchQ] = useState('');
    const [confirmedSearchQ, setConfirmedSearchQ] = useState<string | null>(null);
    const [searchStart, setSearchStart] = useState<string | null>(threeMonthsAgoStr);
    const [searchEnd, setSearchEnd] = useState<string | null>(todayStr);
    const [isSearching, setIsSearching] = useState(true);
    const [activeTag, setActiveTag] = useState<string | null>(null);

    // fetchNotes supports optional tag filtering. If the backend doesn't support tag param,
    // a client-side fallback filters returned notes by tag.
    const fetchNotes = async (opts?: {
        q?: string | null;
        start?: string | null;
        end?: string | null;
        month?: string | null;
        tag?: string | null;
    }) => {
        const params = new URLSearchParams();
        if (opts?.month) params.set('month', opts.month);
        if (opts?.q) params.set('q', opts.q);
        if (opts?.start) params.set('start', opts.start);
        if (opts?.end) params.set('end', opts.end);
        if (opts?.tag) params.set('tag', opts.tag);

        try {
            const res = await fetch(`/api/daily-notes?${params.toString()}`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('failed');
            const json = await res.json();
            let loaded: Note[] = json.notes || [];

            // client-side fallback: when tag filter requested but backend didn't filter,
            // ensure we only keep notes that actually have the tag attached
            if (opts?.tag) {
                const tagName = String(opts.tag);
                loaded = (loaded || []).filter((n: Note) => {
                    const t = n.tags;
                    if (!t) return false;
                    if (Array.isArray(t)) {
                        return t.some((it) => String(it?.name ?? it) === tagName);
                    }
                    // if tags stored as a string, check containment
                    if (typeof t === 'string')
                        return t
                            .split(',')
                            .map((s) => s.trim())
                            .includes(tagName);
                    return false;
                });
            }

            setNotes(loaded);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        // if searching is false, fetch monthly view; otherwise do nothing (search will fetch)
        if (isSearching) return;
        let mounted = true;
        (async () => {
            try {
                if (!mounted) return;
                await fetchNotes({ month: monthStr });
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [monthStr, isSearching]);

    const doSearch = async () => {
        // clear active tag when performing a normal keyword/period search
        setActiveTag(null);
        setIsSearching(true);
        setConfirmedSearchQ(searchQ.trim() || null);
        await fetchNotes({ q: searchQ || null, start: searchStart || null, end: searchEnd || null });
    };

    const handleTagClick = async (tagName: string) => {
        // set tag as active and perform a tag-only search (no date range)
        setActiveTag(tagName);
        // clear keyword search highlighting when filtering by tag
        setSearchQ('');
        setConfirmedSearchQ(null);
        setIsSearching(true);
        setSearchStart(null);
        setSearchEnd(null);
        await fetchNotes({ tag: tagName, start: null, end: null });
        // scroll to top so header/search area is visible after tag click
        try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            // ignore if running in non-browser environment
        }
    };

    useEffect(() => {
        // run initial fetch with default range on mount but do not confirm keyword
        (async () => {
            setIsSearching(true);
            await fetchNotes({ q: null, start: searchStart || null, end: searchEnd || null });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clearSearch = async () => {
        // reset to default 3 months -> today and clear confirmed keyword
        setSearchQ('');
        setConfirmedSearchQ(null);
        // clear active tag when user clears search
        setActiveTag(null);
        setSearchStart(threeMonthsAgoStr);
        setSearchEnd(todayStr);
        // show selected date's notes by exiting search mode and loading the month view
        setIsSearching(false);
        await fetchNotes({ month: monthStr });
    };

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
            // when user clicks a date, exit search mode so the sheet shows that day's notes
            setSelectedDate(date);
            // clear any active tag search so header returns to normal when a date is selected
            setActiveTag(null);
            setIsSearching(false);
        },
        [currentMonth],
    );

    useEffect(() => {
        // Use JST-based today so server/client timezone mismatch doesn't affect day selection
        const now = new Date();
        const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        if (currentMonth.getFullYear() === jstNow.getFullYear() && currentMonth.getMonth() === jstNow.getMonth()) {
            selectDay(jstNow.getDate());
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
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="キーワード検索"
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    className="flex-1 rounded-md border px-2 py-1"
                                />
                                <Button onClick={doSearch}>検索</Button>
                                <Button variant="ghost" onClick={clearSearch}>
                                    クリア
                                </Button>
                            </div>
                            <div className="md;gap-2 flex items-center gap-0.5">
                                <input
                                    type="date"
                                    value={searchStart || ''}
                                    onChange={(e) => setSearchStart(e.target.value || null)}
                                    className="rounded-md border px-2 py-1"
                                />
                                <span className="px-2 text-sm text-muted-foreground">〜</span>
                                <input
                                    type="date"
                                    value={searchEnd || ''}
                                    onChange={(e) => setSearchEnd(e.target.value || null)}
                                    className="rounded-md border px-2 py-1"
                                />
                            </div>
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
                    </div>
                    <div className="col-span-2">
                        {(() => {
                            const notesForSheet = isSearching ? notes : grouped[selectedDate] || [];
                            return (
                                <NoteSheet
                                    key={selectedDate + (isSearching ? '_search' : '')}
                                    selectedDate={selectedDate}
                                    notes={notesForSheet}
                                    currentUserId={currentUserId}
                                    editingNoteId={editingNoteId}
                                    canCreate={hasPermission('daily_note.create')}
                                    onStartEdit={(id: number) => setEditingNoteId(id)}
                                    onCancelEdit={() => setEditingNoteId(null)}
                                    onNoteCreate={handleCreate}
                                    onNoteUpdate={handleUpdate}
                                    onNoteDelete={handleDelete}
                                    onCommentAdd={addComment}
                                    onCommentDelete={deleteComment}
                                    searchQ={confirmedSearchQ ?? ''}
                                    isSearching={isSearching}
                                    activeTag={activeTag}
                                    onTagClick={handleTagClick}
                                />
                            );
                        })()}
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
                                            // compute today's date in JST for accurate 'today' marking
                                            const now = new Date();
                                            const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
                                            const isToday = jstNow.getFullYear() === year && jstNow.getMonth() === month && jstNow.getDate() === day;
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
    canCreate?: boolean;
    searchQ?: string;
    isSearching?: boolean;
    activeTag?: string | null;
    onTagClick?: (tagName: string) => void | Promise<void>;
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
    canCreate,
    searchQ,
    isSearching,
    activeTag,
    onTagClick,
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
    const headerKey = activeTag ?? (searchQ || '');
    const showSearchHeader = !!(isSearching && headerKey && headerKey.toString().trim().length > 0);

    return (
        <div className="space-y-4">
            <div className="text-xl font-bold">
                {activeTag
                    ? `タグ検索：${activeTag}（${notes.length}件）`
                    : showSearchHeader
                      ? `検索結果：${searchQ}（${notes.length}件）`
                      : `ノート: ${selectedDate}（${notes.length}件）`}
            </div>
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
                                highlight={searchQ}
                                isSearching={isSearching}
                                activeTag={activeTag}
                                onTagClick={onTagClick}
                            />
                        )}
                    </div>
                ))}
            </div>
            {canCreate ? (
                <NewNoteForm onSubmit={onNoteCreate} />
            ) : (
                <Card className="mt-6">
                    <CardContent className="p-4 text-sm text-muted-foreground">新しいノートを作成する権限がありません。</CardContent>
                </Card>
            )}
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
    highlight?: string | null;
    isSearching?: boolean;
    activeTag?: string | null;
    onTagClick?: (tagName: string) => void | Promise<void>;
};

function NoteItem({
    note,
    currentUserId,
    onStartEdit,
    onDelete,
    onCommentAdd,
    onCommentDelete,
    highlight,
    isSearching,
    activeTag,
    onTagClick,
}: NoteItemProps) {
    const formatTime = (raw?: string) => (raw ? formatRelativeTime(raw) : '');
    const userName = note.user?.name || note.user_name || '不明';

    // highlightText removed; use renderWithLinks(text, highlight) instead

    // convert URLs in text to clickable links while preserving highlight marking
    const renderWithLinks = (text?: string) => {
        if (!text) return null;
        // URL regex (simple, supports http/https)
        const urlRe = /(https?:\/\/[^\s]+)/g;

        // if highlight is not set, simply split by URLs and map
        if (!highlight) {
            const parts = text.split(urlRe);
            return (
                <>
                    {parts.map((p, i) => {
                        if (urlRe.test(p)) {
                            // reset lastIndex in case regex is stateful
                            urlRe.lastIndex = 0;
                            return (
                                <a
                                    key={i}
                                    href={p}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block max-w-[48ch] truncate text-sky-600 underline hover:text-sky-800"
                                >
                                    {p}
                                </a>
                            );
                        }
                        return <span key={i}>{p}</span>;
                    })}
                </>
            );
        }

        // when highlight is present, we need to both mark highlights and render links
        // strategy: first split by URLs, then within non-URL parts apply highlight marking
        const urlParts = text.split(urlRe);
        return (
            <>
                {urlParts.map((part, idx) => {
                    if (!part) return null;
                    if (urlRe.test(part)) {
                        (urlRe as RegExp).lastIndex = 0;
                        return (
                            <a
                                key={`u-${idx}`}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block max-w-[48ch] truncate text-sky-600 underline hover:text-sky-800"
                            >
                                {part}
                            </a>
                        );
                    }

                    // apply highlight marking inside this non-url chunk
                    try {
                        const re = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi');
                        const parts = part.split(re);
                        return (
                            <span key={`t-${idx}`}>
                                {parts.map((p, i) =>
                                    re.test(p) ? (
                                        <mark key={i} className="bg-yellow-200 text-yellow-900">
                                            {p}
                                        </mark>
                                    ) : (
                                        <span key={i}>{p}</span>
                                    ),
                                )}
                            </span>
                        );
                    } catch {
                        return <span key={`t-${idx}`}>{part}</span>;
                    }
                })}
            </>
        );
    };

    // render body with hashtags removed from inline text (tags will be shown as badges below)
    const bodyWithoutHashes = (note.body || '').replace(/#([\p{L}0-9_-]+)/gu, '').trim();

    return (
        <div className="flex items-start gap-4 rounded-lg border bg-card p-4 text-card-foreground">
            <Avatar>
                <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userName)}`} />
                <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold">{userName}</span>
                            <span className="text-muted-foreground">{formatTime(note.created_at)}</span>
                        </div>
                        {/* show note date in search results so user knows which day this note belongs to */}
                        {isSearching && note.date && <div className="text-xs text-muted-foreground">{note.date}</div>}
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

                <div className="mt-2 text-sm break-words break-all whitespace-pre-wrap">{renderWithLinks(bodyWithoutHashes || note.body)}</div>

                {Array.isArray(note.attachments) && note.attachments.length > 0 && <NoteAttachments attachments={note.attachments} />}

                {Array.isArray(note.tags) && note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {note.tags.map((t: { id?: number; name?: string }) => (
                            <button
                                key={t.id ?? t.name}
                                type="button"
                                onClick={() => onTagClick && onTagClick(t.name || '')}
                                className={`inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-800 ${activeTag === t.name ? 'ring-2 ring-primary' : ''}`}
                            >
                                #{t.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-4 border-t pt-3">
                    <CommentSection
                        noteId={note.id!}
                        comments={note.comments || []}
                        currentUserId={currentUserId}
                        onCommentAdd={onCommentAdd}
                        onCommentDelete={onCommentDelete}
                        highlight={highlight}
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
                    <button key={i} onClick={() => openAt(i)} className="h-32 overflow-hidden rounded-md border">
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

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
        const urls = prevUrlsRef.current.slice();
        if (urls[index]) URL.revokeObjectURL(urls[index]);
        const newUrls = urls.filter((_, i) => i !== index);
        prevUrlsRef.current = newUrls;
        setPreviewUrls(newUrls);
        // reset file input to allow re-adding same file
        if (fileRef.current) fileRef.current.value = '';
    };

    const clearAllAttachments = () => {
        setAttachments([]);
        prevUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        prevUrlsRef.current = [];
        setPreviewUrls([]);
        if (fileRef.current) fileRef.current.value = '';
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
                    <div className="text-sm text-muted-foreground">
                        <p>
                            <span className="font-medium">タグの付け方</span>
                            <br></br>・本文中に <span className="font-medium">#タグ名</span> の形式で記載してください。
                            <br></br>・複数指定する場合はスペースで区切ります。<br></br>
                            ・タグは投稿後に一覧で表示され、タグをクリックするとそのタグが付いた投稿のみ検索できます。
                        </p>
                    </div>
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
                                    <div
                                        key={i}
                                        className="relative h-32 cursor-pointer overflow-hidden rounded-md border"
                                        onClick={() => {
                                            setStartIndex(i);
                                            setModalOpen(true);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && (setStartIndex(i), setModalOpen(true))}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <img src={src} className="h-full w-full object-cover" alt={`new-attach-${i}`} />
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeAttachment(i);
                                            }}
                                            className="absolute top-1 right-1 z-10 rounded-full bg-background/80 p-1 text-xs"
                                            aria-label="削除"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">{attachments.length}件のファイルが選択されています。</div>
                                <div>
                                    <button type="button" className="rounded border px-3 py-1 text-sm" onClick={clearAllAttachments}>
                                        添付を取消
                                    </button>
                                </div>
                            </div>
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
    const [saving, setSaving] = useState(false);
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
                                    className="h-32 overflow-hidden rounded-md border"
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
                    <Button variant="ghost" onClick={() => onCancel()} disabled={saving}>
                        キャンセル
                    </Button>
                    <Button
                        onClick={async () => {
                            if (saving) return;
                            try {
                                setSaving(true);
                                // support both sync and async onSave
                                await Promise.resolve(onSave(note.id!, body, newAttachments, deletedAttachmentIds));
                            } catch (err) {
                                console.error(err);
                            } finally {
                                setSaving(false);
                            }
                        }}
                        disabled={saving}
                    >
                        {saving ? '保存中...' : '保存する'}
                    </Button>
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
    highlight?: string | null;
};

function CommentSection({ noteId, comments, currentUserId, onCommentAdd, onCommentDelete, highlight }: CommentSectionProps) {
    const [quote, setQuote] = useState<Comment | null>(null);
    const formatTime = (raw?: string) => (raw ? formatRelativeTime(raw) : '');

    const highlightText = (text?: string) => {
        if (!text || !highlight) return <>{text}</>;
        try {
            const re = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            const parts = text.split(re);
            return (
                <>
                    {parts.map((p, i) =>
                        re.test(p) ? (
                            <mark key={i} className="bg-yellow-200 text-yellow-900">
                                {p}
                            </mark>
                        ) : (
                            <span key={i}>{p}</span>
                        ),
                    )}
                </>
            );
        } catch {
            return <>{text}</>;
        }
    };

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
                                        @{c.quote.user?.name}: {highlightText(c.quote.body)}
                                    </p>
                                </div>
                            )}
                            <p className="mt-1 break-words break-all whitespace-pre-wrap">{renderWithLinks(c.body, highlight)}</p>
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
    const [sending, setSending] = useState(false);

    const handleSubmit = async () => {
        if (!text.trim() || sending) return;
        try {
            setSending(true);
            await Promise.resolve(onSubmit(text, quote?.id));
            setText('');
            onClearQuote();
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
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
                <Button onClick={handleSubmit} disabled={!text.trim() || sending}>
                    {sending ? '送信中...' : '送信'}
                </Button>
            </div>
        </div>
    );
}
