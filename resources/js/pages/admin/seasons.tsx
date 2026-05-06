import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, Calendar, CheckCircle, PlusCircle, XCircle } from 'lucide-react';
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
                                            {!season.is_active && !season.ended_at && (
                                                <Button size="sm" variant="outline" onClick={() => handleActivate(season)} disabled={submitting}>
                                                    アクティブ化
                                                </Button>
                                            )}
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
            </div>
        </AppSidebarLayout>
    );
}
