import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, Calendar, CheckCircle, PlusCircle, UserPlus, XCircle } from 'lucide-react';
import { useState } from 'react';

interface Season {
    id: number;
    name: string;
    is_active: boolean;
    ended_at: string | null;
    note: string | null;
    users_count: number;
    created_at: string;
}

interface SeasonUser {
    id: number;
    name: string;
    furigana: string | null;
    email: string;
    position: number | null;
    gender: string | null;
    roles: string[];
    already_imported: boolean;
}

interface PageProps {
    seasons: Season[];
    activeSeason: Season | null;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: '各種設定', href: '/admin/seasons' },
    { title: 'シーズン管理', href: '' },
];

export default function SeasonsPage() {
    const page = usePage<{ props: PageProps }>();
    const { seasons, activeSeason, flash } = page.props as unknown as PageProps;

    const [showNewForm, setShowNewForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newNote, setNewNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState<Season | null>(null);

    // ユーザー再利用モーダル
    const [importSeason, setImportSeason] = useState<Season | null>(null);
    const [seasonUsers, setSeasonUsers] = useState<SeasonUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const openImportModal = async (season: Season) => {
        setImportSeason(season);
        setSelectedUserIds([]);
        setLoadingUsers(true);
        try {
            const res = await fetch(`/admin/seasons/${season.id}/users`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: unknown = await res.json();
            setSeasonUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('ユーザー一覧の取得に失敗しました', e);
            setSeasonUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    const closeImportModal = () => {
        setImportSeason(null);
        setSeasonUsers([]);
        setSelectedUserIds([]);
    };

    const toggleUser = (id: number) => {
        setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleAll = () => {
        const selectable = seasonUsers.filter((u) => !u.already_imported).map((u) => u.id);
        setSelectedUserIds((prev) => (prev.length === selectable.length ? [] : selectable));
    };

    const handleImport = () => {
        if (!importSeason || selectedUserIds.length === 0) return;
        setSubmitting(true);
        router.post(
            `/admin/seasons/${importSeason.id}/import-users`,
            { user_ids: selectedUserIds },
            {
                onFinish: () => {
                    setSubmitting(false);
                    closeImportModal();
                },
            },
        );
    };

    const handleCreate = () => {
        if (!newName.trim()) return;
        setSubmitting(true);
        router.post(
            '/admin/seasons',
            { name: newName.trim(), note: newNote.trim() || null },
            {
                onFinish: () => {
                    setSubmitting(false);
                    setShowNewForm(false);
                    setNewName('');
                    setNewNote('');
                },
            },
        );
    };

    const handleEnd = (season: Season) => {
        setConfirmEnd(season);
    };

    const confirmEndSeason = () => {
        if (!confirmEnd) return;
        setSubmitting(true);
        router.post(
            `/admin/seasons/${confirmEnd.id}/end`,
            {},
            {
                onFinish: () => {
                    setSubmitting(false);
                    setConfirmEnd(null);
                },
            },
        );
    };

    const handleActivate = (season: Season) => {
        if (!confirm(`シーズン「${season.name}」を再アクティブ化しますか？`)) return;
        router.post(`/admin/seasons/${season.id}/activate`);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="シーズン管理" />
            <div className="mx-auto max-w-4xl space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <Calendar className="h-6 w-6" />
                        シーズン管理
                    </h1>
                    <Button onClick={() => setShowNewForm((v) => !v)} className="flex items-center gap-2">
                        <PlusCircle className="h-4 w-4" />
                        新シーズン作成
                    </Button>
                </div>

                {/* フラッシュメッセージ */}
                {flash?.success && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                        <XCircle className="h-4 w-4 shrink-0" />
                        {flash.error}
                    </div>
                )}

                {/* 現在のシーズン情報 */}
                {activeSeason ? (
                    <Card className="border-blue-200 bg-blue-50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-blue-800">現在のアクティブシーズン</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div>
                                <span className="text-xl font-bold text-blue-900">{activeSeason.name}</span>
                                <p className="mt-1 text-sm text-blue-600">登録ユーザー数: {activeSeason.users_count}人</p>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={() => handleEnd(activeSeason)}
                                className="flex items-center gap-2"
                                disabled={submitting}
                            >
                                <XCircle className="h-4 w-4" />
                                シーズン終了
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="flex items-center gap-3 pt-6 text-orange-800">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span>現在アクティブなシーズンがありません。新しいシーズンを作成してください。</span>
                        </CardContent>
                    </Card>
                )}

                {/* 新シーズン作成フォーム */}
                {showNewForm && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">新しいシーズンを作成</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">
                                    シーズン名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="例: 2026-27シーズン"
                                    className="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">メモ（任意）</label>
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleCreate} disabled={!newName.trim() || submitting}>
                                    作成する
                                </Button>
                                <Button variant="outline" onClick={() => setShowNewForm(false)}>
                                    キャンセル
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ※ 新しいシーズンを作成すると、現在のアクティブシーズンは自動的に非アクティブになります。
                                ただし、終了済みにはなりません。終了させる場合は先に「シーズン終了」を実行してください。
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* シーズン一覧 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">シーズン一覧</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>シーズン名</TableHead>
                                    <TableHead>状態</TableHead>
                                    <TableHead>ユーザー数</TableHead>
                                    <TableHead>終了日時</TableHead>
                                    <TableHead>作成日</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {seasons.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                            シーズンが登録されていません
                                        </TableCell>
                                    </TableRow>
                                )}
                                {seasons.map((season) => (
                                    <TableRow key={season.id}>
                                        <TableCell className="font-medium">{season.name}</TableCell>
                                        <TableCell>
                                            {season.is_active ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">アクティブ</Badge>
                                            ) : season.ended_at ? (
                                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                                    終了済み
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-orange-300 text-orange-600">
                                                    非アクティブ
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{season.users_count}人</TableCell>
                                        <TableCell>{formatDate(season.ended_at)}</TableCell>
                                        <TableCell>{formatDate(season.created_at)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {!season.is_active && !season.ended_at && (
                                                    <Button size="sm" variant="outline" onClick={() => handleActivate(season)} disabled={submitting}>
                                                        アクティブ化
                                                    </Button>
                                                )}
                                                {!season.is_active && activeSeason && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex items-center gap-1"
                                                        onClick={() => openImportModal(season)}
                                                    >
                                                        <UserPlus className="h-3.5 w-3.5" />
                                                        ユーザーを再利用
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* シーズン終了確認ダイアログ */}
                {confirmEnd && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <Card className="mx-4 w-full max-w-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-700">
                                    <AlertTriangle className="h-5 w-5" />
                                    シーズン終了の確認
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm">
                                    シーズン「<strong>{confirmEnd.name}</strong>」を終了しますか？
                                </p>
                                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                                    <li>このシーズンのデータは読み取り専用になります</li>
                                    <li>終了後は再アクティブ化できません</li>
                                    <li>新しいシーズンに同じメールアドレスで新規登録できます</li>
                                </ul>
                                <div className="flex gap-2 pt-2">
                                    <Button variant="destructive" onClick={confirmEndSeason} disabled={submitting}>
                                        シーズンを終了する
                                    </Button>
                                    <Button variant="outline" onClick={() => setConfirmEnd(null)}>
                                        キャンセル
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
                {/* ユーザー再利用モーダル */}
                {importSeason && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <Card className="flex max-h-[80vh] w-full max-w-2xl flex-col">
                            <CardHeader className="shrink-0 pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <UserPlus className="h-5 w-5" />「{importSeason.name}」のユーザーを再利用
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    選択したユーザーを現在のアクティブシーズンにコピーします。新しい一時パスワードが発行されます。
                                </p>
                            </CardHeader>
                            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                                {loadingUsers ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">読み込み中...</div>
                                ) : seasonUsers.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">ユーザーが存在しません</div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between text-sm">
                                            <button type="button" className="text-blue-600 hover:underline" onClick={toggleAll}>
                                                {selectedUserIds.length === seasonUsers.filter((u) => !u.already_imported).length
                                                    ? 'すべて解除'
                                                    : 'すべて選択'}
                                            </button>
                                            <span className="text-muted-foreground">{selectedUserIds.length}人選択中</span>
                                        </div>
                                        <div className="overflow-y-auto rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-10"></TableHead>
                                                        <TableHead>名前</TableHead>
                                                        <TableHead>メールアドレス</TableHead>
                                                        <TableHead>ロール</TableHead>
                                                        <TableHead className="w-28">状態</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {seasonUsers.map((user) => (
                                                        <TableRow
                                                            key={user.id}
                                                            className={user.already_imported ? 'opacity-40' : 'cursor-pointer hover:bg-muted/50'}
                                                            onClick={() => !user.already_imported && toggleUser(user.id)}
                                                        >
                                                            <TableCell>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedUserIds.includes(user.id)}
                                                                    disabled={user.already_imported}
                                                                    onChange={() => toggleUser(user.id)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="h-4 w-4"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-medium">{user.name}</div>
                                                                {user.furigana && (
                                                                    <div className="text-xs text-muted-foreground">{user.furigana}</div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-sm">{user.email}</TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {user.roles.map((r) => (
                                                                        <Badge key={r} variant="outline" className="text-xs">
                                                                            {r}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {user.already_imported ? (
                                                                    <span className="text-xs text-muted-foreground">登録済み</span>
                                                                ) : (
                                                                    <span className="text-xs text-green-700">インポート可</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                )}
                                <div className="flex shrink-0 gap-2 pt-1">
                                    <Button
                                        onClick={handleImport}
                                        disabled={selectedUserIds.length === 0 || submitting || loadingUsers}
                                        className="flex items-center gap-2"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        {selectedUserIds.length}人をインポート
                                    </Button>
                                    <Button variant="outline" onClick={closeImportModal}>
                                        キャンセル
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppSidebarLayout>
    );
}
