import ImageModal from '@/components/posts/image-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
// Ensure the emoji-picker web component is registered at runtime by importing the module for its side-effects.
import 'emoji-picker-element';
import { Edit, Globe, Plus, Printer, Smile, Tag, Trash } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const breadcrumbs = [
    { title: '掲示板', href: route('posts.index') },
    { title: '投稿詳細', href: '' },
];

// --- 投票表示コンポーネント (新規追加) ---
const PollDisplay = ({ initialPostData }: { initialPostData: Post }) => {
    const { auth } = usePage().props as any;
    const [post, setPost] = useState<Post>(initialPostData);
    const poll = post.poll;

    const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // current user id (may be undefined if not logged in)
    const currentUserId = auth?.user?.id ?? null;
    // determine if current user is system admin (roles may vary; check common names)
    const isAdmin = !!(
        auth?.user &&
        Array.isArray(auth.user.roles) &&
        auth.user.roles.some((r: any) => r && (r.name === 'システム管理者' || r.name === 'System Administrator' || r.name === 'admin'))
    );

    // 投票が終了しているか
    const isExpired = useMemo(() => {
        return poll?.expires_at ? new Date(poll.expires_at) < new Date() : false;
    }, [poll?.expires_at]);

    // ★修正点1: サーバーから渡されるhas_votedフラグを優先的に使用する
    // これにより、投票者リストが見えなくても自分が投票済みか判定できる
    const hasVoted = useMemo(() => {
        if (!poll?.options) return false;
        // サーバーからの `has_voted` フラグがあればそれを使用
        if (typeof poll?.has_voted === 'boolean') {
            return poll.has_voted;
        }
        // サーバー側の votes 配列に現在ユーザーの投票が記録されているか確認
        const votedOnServer = poll.options.some((opt: any) =>
            (opt.votes || []).some((vote: any) => {
                if (!vote) return false;
                if (vote.user_id && currentUserId) return Number(vote.user_id) === Number(currentUserId);
                if (vote.user && vote.user.id && currentUserId) return Number(vote.user.id) === Number(currentUserId);
                return false;
            }),
        );
        // 匿名投票などでサーバーがユーザーを紐付けられない場合のフォールバックとしてlocalStorageを確認
        let votedLocal = false;
        try {
            if (typeof window !== 'undefined' && poll && poll.id) {
                votedLocal = !!localStorage.getItem(`poll_voted_${poll.id}`);
            }
        } catch (e) {
            votedLocal = false;
        }
        return votedOnServer || votedLocal;
    }, [poll?.options, currentUserId, poll?.id, poll]);

    // 全体の投票数
    const totalVotes = useMemo(() => {
        if (!poll?.options) return 0;
        return poll.options.reduce((sum, opt) => sum + (opt.votes_count ?? opt.votes?.length ?? 0), 0);
    }, [poll?.options]);

    // 投票ボタンが押された時の処理
    const handleVote = async () => {
        if (selectedOptions.length === 0 || !poll) return;
        setSubmitting(true);
        try {
            const response = await axios.post(route('polls.vote', poll.id), {
                option_ids: selectedOptions,
            });
            // 投票成功時はローカルにも投票済みフラグを保存してから必ずページをリロードし、
            // サーバーから最新の投票情報（投票者名含む）を取得する
            try {
                if (typeof window !== 'undefined' && poll && poll.id) {
                    // 投票した選択肢の id 配列を保存する
                    try {
                        localStorage.setItem(`poll_voted_${poll.id}`, JSON.stringify(selectedOptions));
                    } catch (e) {
                        // 保存失敗しても処理は続ける
                    }
                }
            } catch (e) {}
            try {
                window.location.reload();
                return;
            } catch (e) {
                // reload に失敗した場合のみ state を更新して続行
                setPost(response.data);
            }
        } catch (error) {
            console.error('投票に失敗しました:', error);
            alert('投票エラーが発生しました。');
        } finally {
            setSubmitting(false);
        }
    };

    // 有効期限を m/d (短縮曜日) 形式で返す
    const formatExpiryDate = (iso?: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            const monthDay = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
            const weekday = d.toLocaleDateString('ja-JP', { weekday: 'short' });
            return `${monthDay} (${weekday})`;
        } catch (e) {
            return '';
        }
    };

    // 有効期限を m/d (短縮曜日) HH:MM 形式で返す
    const formatExpiryDateWithTime = (iso?: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            const monthDay = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
            const weekday = d.toLocaleDateString('ja-JP', { weekday: 'short' });
            const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            return `${monthDay} (${weekday}) ${time}`;
        } catch (e) {
            return '';
        }
    };

    const handleOptionChange = (optionId: number) => {
        if (poll?.allow_multiple_votes) {
            setSelectedOptions((prev) => (prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]));
        } else {
            setSelectedOptions([optionId]);
        }
    };

    if (!poll) return null;

    return (
        <div className="my-6 space-y-4 rounded-lg border p-4">
            <div className="flex flex-col items-start justify-between">
                <div className="flex w-full items-center justify-between">
                    <h3 className="text-lg font-bold">
                        投票 {/* カード上部に期限を表示 (m/d (曜) HH:MM) */}
                        {poll?.expires_at ? (
                            <span className="ml-2 text-xs text-red-600">{formatExpiryDateWithTime(poll.expires_at)} まで</span>
                        ) : (
                            <span className="ml-2 text-xs text-gray-500">期限なし</span>
                        )}
                    </h3>
                    <div className="flex items-center gap-3">
                        {isExpired && <Badge variant="destructive">この投票は終了しました</Badge>}
                        {/* 単一のやり直すボタン: 投票済み && 期限内 */}
                        {!isExpired && hasVoted && (
                            <button
                                type="button"
                                className="text-sm text-blue-600 hover:underline"
                                onClick={async () => {
                                    if (!poll) return;
                                    try {
                                        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                        const res = await axios.post(
                                            route('polls.reset', poll.id),
                                            {},
                                            { withCredentials: true, headers: { 'X-CSRF-TOKEN': token } },
                                        );
                                        if (res && res.data) {
                                            setPost(res.data);
                                            try {
                                                if (typeof window !== 'undefined') localStorage.removeItem(`poll_voted_${poll.id}`);
                                            } catch (e) {}
                                        }
                                    } catch (err: any) {
                                        console.error('投票のやり直しに失敗しました', err);
                                        const message = err?.response?.data?.message || err?.message || '投票のやり直しに失敗しました。';
                                        alert(message);
                                    }
                                }}
                            >
                                投票をやり直す
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {poll.options.map((option) => {
                    const votesCount = option.votes_count ?? option.votes?.length ?? 0;
                    const percentage = totalVotes > 0 ? (votesCount / totalVotes) * 100 : 0;
                    // このオプションに現在ユーザーが投票しているかどうか
                    const userVotedThis = (() => {
                        try {
                            // まずはサーバー側の votes に現在のユーザーが含まれているか確認
                            if (currentUserId && option.votes && option.votes.length > 0) {
                                return option.votes.some((v: any) => {
                                    if (!v) return false;
                                    if (v.user_id && currentUserId) return Number(v.user_id) === Number(currentUserId);
                                    if (v.user && v.user.id && currentUserId) return Number(v.user.id) === Number(currentUserId);
                                    return false;
                                });
                            }

                            // 次に localStorage に保存した選択肢ID配列を確認して、当該 option.id が含まれているかだけを判定する
                            if (typeof window !== 'undefined' && poll && poll.id) {
                                const raw = localStorage.getItem(`poll_voted_${poll.id}`);
                                if (raw) {
                                    try {
                                        const arr = JSON.parse(raw);
                                        if (Array.isArray(arr)) return arr.includes(option.id);
                                    } catch (e) {
                                        // 旧仕様で '1' を保存している場合は無視する（全選択肢ハイライトはしない）
                                    }
                                }
                            }
                        } catch (err) {
                            // 判定失敗時は安全のため false を返す
                        }
                        return false;
                    })();

                    // 結果表示モード (投票済み or 期限切れ)
                    if (isExpired || hasVoted) {
                        return (
                            <div key={option.id} className="relative">
                                <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className={`flex items-center gap-2 font-medium ${userVotedThis ? 'font-semibold text-emerald-700' : ''}`}>
                                        <span>{option.value}</span>
                                        {userVotedThis && (
                                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                                投票済み
                                            </span>
                                        )}
                                    </span>
                                    <span>
                                        {votesCount}票 ({percentage.toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="h-4 w-full rounded-full bg-gray-200">
                                    <div
                                        className={`h-4 rounded-full ${userVotedThis ? 'bg-emerald-600' : 'bg-blue-600'}`}
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                                {/* ★修正点2: option.votesが存在する場合のみ投票者リストを表示 */}
                                {/* これで匿名投票の権限制御が機能する */}
                                {option.votes &&
                                    option.votes.length > 0 &&
                                    // 非匿名なら全員に表示。匿名の場合は投稿者（post.user.id）または管理者のみ表示。
                                    (!poll.is_anonymous ||
                                    (post?.user && currentUserId && Number(post.user.id) === Number(currentUserId)) ||
                                    isAdmin ? (
                                        <div className="mt-1 pl-2 text-xs text-gray-500">
                                            投票者:{' '}
                                            {option.votes
                                                .map((v: any) => v.user?.name)
                                                .filter(Boolean)
                                                .join(', ')}
                                        </div>
                                    ) : null)}
                            </div>
                        );
                    }

                    // 投票フォームモード
                    return (
                        <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded border p-3 hover:bg-gray-50">
                            <input
                                type={poll.allow_multiple_votes ? 'checkbox' : 'radio'}
                                name="poll_option"
                                checked={selectedOptions.includes(option.id)}
                                onChange={() => handleOptionChange(option.id)}
                                className={poll.allow_multiple_votes ? 'rounded' : 'rounded-full'}
                            />
                            <span>{option.value}</span>
                        </label>
                    );
                })}
            </div>

            {!isExpired && !hasVoted && (
                <div className="flex items-center justify-end">
                    <Button onClick={handleVote} disabled={submitting || selectedOptions.length === 0}>
                        {submitting ? '投票中...' : '投票する'}
                    </Button>
                </div>
            )}
        </div>
    );
};

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
    const isAdmin = !!(
        (props as any).auth?.user &&
        Array.isArray((props as any).auth.user.roles) &&
        (props as any).auth.user.roles.some((r: any) => r && r.name === 'システム管理者')
    );

    const [modalOpen, setModalOpen] = useState(false);
    const [modalStartIndex, setModalStartIndex] = useState(0);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [manualModalImages, setManualModalImages] = useState<
        Array<{ url: string; isImage?: boolean; isVideo?: boolean; original_name?: string; size?: number }>
    >([]);
    const [manualModalStartIndex, setManualModalStartIndex] = useState(0);
    // printing will use a hidden iframe appended to the document

    const postAttachments = useMemo((): { url: string; isImage: boolean; isVideo?: boolean; original_name?: string; size?: number }[] => {
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
                const isVideo = typeof url === 'string' && /\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(url);
                const size = (a as any).size || (a as any).file_size || (a as any).byte_size || (a as any).filesize || undefined;
                return { url, isImage, isVideo, original_name: a.original_name, size };
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
                try {
                    // notify other parts of the app (dashboard) that this post was read
                    if (typeof window !== 'undefined' && post?.id) {
                        window.dispatchEvent(new CustomEvent('postRead', { detail: post.id }));
                    }
                } catch (err) {
                    // ignore dispatch errors
                }
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

    // Convert plain text URLs into clickable links (returns React nodes)
    function linkifyText(text?: string) {
        if (!text) return null;
        const urlRe = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRe);
        return parts.map((part, i) => {
            if (urlRe.test(part)) {
                // reset lastIndex in case regex is stateful
                (urlRe as RegExp).lastIndex = 0;
                return (
                    <a
                        key={`l-${i}`}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words break-all !text-sky-600 underline hover:!text-sky-800"
                    >
                        {part}
                    </a>
                );
            }
            // preserve line breaks
            const lines = part.split('\n');
            return lines.map((ln, j) => (
                <span key={`t-${i}-${j}`}>
                    {ln}
                    {j < lines.length - 1 ? <br /> : null}
                </span>
            ));
        });
    }

    // Render HTML string to React nodes, converting text-node URLs into clickable links
    function renderHtmlWithLinks(html?: string) {
        if (!html) return null;
        try {
            const container = document.createElement('div');
            container.innerHTML = html;

            let keyCounter = 0;

            const nodeToReact = (node: ChildNode): React.ReactNode => {
                const key = `n-${keyCounter++}`;
                if (node.nodeType === Node.TEXT_NODE) {
                    const txt = node.textContent || '';
                    return <span key={key}>{linkifyText(txt)}</span>;
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node as Element;
                    const tag = el.tagName.toLowerCase();
                    const props: Record<string, string> = { key } as Record<string, string>;
                    // copy attributes (class -> className)
                    for (let i = 0; i < el.attributes.length; i++) {
                        const a = el.attributes[i];
                        const name = a.name === 'class' ? 'className' : a.name;
                        props[name] = a.value;
                    }
                    // Ensure anchors open in a new tab and have hover styles
                    if (tag === 'a') {
                        if (!props['target']) props['target'] = '_blank';
                        if (!props['rel']) props['rel'] = 'noopener noreferrer';
                        const existing = props['className'] || '';
                        const hoverClass = 'text-sky-600 underline hover:text-sky-800 break-words break-all';
                        props['className'] = (existing ? existing + ' ' : '') + hoverClass;
                    }
                    const children = Array.from(el.childNodes).map((c) => nodeToReact(c));
                    return React.createElement(tag, props, children.length === 0 ? null : children);
                }
                return null;
            };

            return Array.from(container.childNodes).map((n) => nodeToReact(n));
        } catch (err) {
            console.error(err);
            return <div dangerouslySetInnerHTML={{ __html: html || '' }} />;
        }
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
                    line-height: 1.4;
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
                    margin-bottom: 0.3rem;
                }
                .post-body ul > li,
                .post-body ol > li {
                    margin-bottom: 0.2rem;
                }
                .post-body p + p,
                .post-body p + h2,
                .post-body h2 + p,
                .post-body h3 + p {
                    margin-top: 0.3rem;
                }
            `}</style>
            <div className="py-12">
                <div className="mx-auto max-w-5xl sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader className="border-b bg-gray-50 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h1 className="max-w-full text-xl font-bold break-words whitespace-normal sm:text-2xl">
                                                {post?.title || '(無題)'}
                                            </h1>
                                            {isDraft(post) && <Badge className="border-yellow-300 bg-yellow-50 text-yellow-800">下書き</Badge>}
                                        </div>
                                        <div className="mt-1 truncate text-sm text-muted-foreground">
                                            <span>{post?.user?.name || '—'}</span>
                                            <br></br>
                                            <span className="text-xs">
                                                最終更新日時：
                                                {post?.updated_at
                                                    ? new Date(post.updated_at).toLocaleString('ja-JP', {
                                                          year: 'numeric',
                                                          month: 'numeric',
                                                          day: 'numeric',
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : '—'}
                                            </span>
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
                                    {post?.type !== 'poll' && (
                                        <Button variant="outline" onClick={handlePrint}>
                                            <Printer className="mr-2 h-4 w-4" /> 印刷
                                        </Button>
                                    )}
                                    {(post?.user && currentUserId === post.user.id) || isAdmin
                                        ? // 投稿が poll タイプで、かつ有効期限が過ぎている場合は編集を不可にする
                                          (() => {
                                              const isPoll = post?.type === 'poll';
                                              let pollExpired = false;
                                              try {
                                                  if (isPoll && post?.poll?.expires_at) {
                                                      const exp = new Date(post.poll.expires_at);
                                                      if (!isNaN(exp.getTime())) {
                                                          pollExpired = exp < new Date();
                                                      }
                                                  }
                                              } catch {
                                                  // ignore parsing errors and treat as not expired
                                                  pollExpired = false;
                                              }

                                              return (
                                                  <>
                                                      {!pollExpired && (
                                                          <Link href={post ? route('posts.edit', post.id) : '#'}>
                                                              <Button variant="outline">
                                                                  <Edit className="mr-2 h-4 w-4" /> 編集
                                                              </Button>
                                                          </Link>
                                                      )}
                                                      <Button size="sm" variant="destructive" onClick={handleDelete}>
                                                          <Trash className="mr-2 h-4 w-4" /> 削除
                                                      </Button>
                                                  </>
                                              );
                                          })()
                                        : null}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {post.type === 'board' && (
                                <div className="max-w-none">
                                    <style>{`
                                        .post-body-content p { margin: 0 0 0.3em 0; line-height: 1.4; }
                                        .post-body-content h1, .post-body-content h2, .post-body-content h3, .post-body-content h4 { margin: 0.4em 0 0.3em 0; }
                                        .post-body-content ul, .post-body-content ol { margin: 0.3em 0; }
                                        .post-body-content br { display: block; content: ""; margin: 0.15em 0; }
                                        .post-body-content h1 { font-size: 20px; font-weight: bold; }
                                        .post-body-content h2 { font-size: 18px; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
                                        .post-body-content h3 { font-size: 16px; font-weight: bold; }
                                        .post-body-content h4 { font-size: 15px; font-weight: bold; }
                                        .post-body-content table { width: 100%; border-collapse: collapse; margin: 8px 0; }
                                        .post-body-content th, .post-body-content td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
                                        .post-body-content ul { padding-left: 1.25rem; }
                                    `}</style>
                                    <div className="post-body-content text-sm" dangerouslySetInnerHTML={{ __html: post.body || '' }} />
                                </div>
                            )}
                            {post.type === 'poll' && (
                                <>
                                    <div className="prose max-w-none text-sm">
                                        {/* Show poll description if present. Escape HTML and preserve newlines as <br/> */}
                                        {post?.poll?.description ? (
                                            <div
                                                className="poll-description text-sm whitespace-pre-wrap text-gray-700"
                                                // description is user-provided plain text; escape and preserve newlines
                                                dangerouslySetInnerHTML={{
                                                    __html: (function () {
                                                        try {
                                                            const esc = escapeHtml(String(post.poll.description || ''));
                                                            return esc.replace(/\r?\n/g, '<br/>');
                                                        } catch (e) {
                                                            return '';
                                                        }
                                                    })(),
                                                }}
                                            />
                                        ) : null}
                                    </div>
                                    <PollDisplay initialPostData={post} />
                                </>
                            )}
                            {post?.type === 'manual' ? (
                                <div className="space-y-6">
                                    {manualItems.map(
                                        (
                                            it: {
                                                id?: number | string;
                                                content?: string;
                                                attachments?: Array<{ url?: string; isImage?: boolean; original_name?: string; size?: number }>;
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
                                                            {renderHtmlWithLinks(it.content)}
                                                        </div>
                                                    </div>
                                                </div>
                                                {Array.isArray(it.attachments) && it.attachments.length > 0 && (
                                                    <div className={`mt-3 grid ${it.attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                                                        {it.attachments.map(
                                                            (
                                                                a: { url?: string; isImage?: boolean; original_name?: string; size?: number },
                                                                ai: number,
                                                            ) => (
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
                                                                                const items = (it.attachments || [])
                                                                                    .filter((x: any) => !!x.url)
                                                                                    .map(
                                                                                        (x: any) =>
                                                                                            x as {
                                                                                                url: string;
                                                                                                isImage?: boolean;
                                                                                                isVideo?: boolean;
                                                                                                original_name?: string;
                                                                                                size?: number;
                                                                                            },
                                                                                    );
                                                                                setManualModalImages(items);
                                                                                const idx = items.findIndex((u: any) => u.url === (a.url || ''));
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
                                                    ) : p.isVideo ? (
                                                        <video
                                                            src={p.url}
                                                            className="h-full w-full cursor-pointer object-contain"
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
            {modalOpen && <ImageModal images={postAttachments} startIndex={modalStartIndex} onClose={() => setModalOpen(false)} />}

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
