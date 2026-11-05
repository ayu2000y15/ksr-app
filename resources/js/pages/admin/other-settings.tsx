import RichTextEditorTiptap from '@/components/rich-text-editor-tiptap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function OtherSettings(): JSX.Element {
    const page: any = usePage();
    const initialDays = Number(page.props.leave_request_deadline_days ?? 14);
    const initialNotice = String(page.props.shift_applications_notice ?? '');

    const breadcrumbs = [
        { title: '各種設定', href: route('admin.role-permissions') },
        { title: 'その他', href: '' },
    ];

    const [days, setDays] = useState<string>(String(initialDays));
    const [notice, setNotice] = useState<string>(initialNotice);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const flash = page.props.flash as any;

    const save = () => {
        const n = Number(days);
        if (!Number.isInteger(n) || n < 0 || n > 365) {
            setToast({ message: '0〜365の整数で入力してください。', type: 'error' });
            return;
        }
        setSaving(true);
        router.patch(
            route('admin.other-settings.update'),
            { leave_request_deadline_days: n, shift_applications_notice: notice },
            {
                preserveScroll: true,
                onSuccess: () => setToast({ message: flash?.success ?? '設定を保存しました。', type: 'success' }),
                onError: () => setToast({ message: '保存に失敗しました。', type: 'error' }),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="その他設定" />
            <style>{`
                .shift-applications-notice p { margin: 0 0 0.25rem; line-height: 1.4; }
                .shift-applications-notice p:last-child { margin-bottom: 0; }
                .shift-applications-notice strong { font-weight: 700; }
                .shift-applications-notice ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
                .shift-applications-notice ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
                .shift-applications-notice a { text-decoration: underline; }
            `}</style>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <h2 className="text-lg font-medium">その他設定</h2>
                </div>

                <Card className="mb-6 max-w-xl">
                    <CardHeader>
                        <CardTitle>休暇申請ボタンの表示設定</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium" htmlFor="leave-days">
                                休暇申請ボタンを表示する日数（対象日の何日前まで）
                            </label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="leave-days"
                                    type="number"
                                    min={0}
                                    max={365}
                                    value={days}
                                    onChange={(e) => setDays(e.target.value)}
                                    className="w-32"
                                />
                                <span className="text-sm text-muted-foreground">日前まで</span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                各種申請ページの休暇申請ボタンを、対象日の指定日数前まで表示します。<br></br>
                                例：14 と入力すると、対象日の14日前まで申請ボタンを表示し、 <br></br>
                                残り日数がそれを下回ると非表示になります。<br></br>
                                <strong>0</strong> を入力すると全期間（対象日まで）表示します。
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="max-w-3xl">
                    <CardHeader>
                        <CardTitle>各種申請ページの注意書き</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            各種申請ページ上部の黄色い注意書き欄に表示される内容です。文字を選択してツールバーの
                            <strong>「太字」</strong>やパレット（<span className="font-semibold text-red-600">赤</span>など）で装飾できます。
                        </p>
                        <RichTextEditorTiptap value={notice} onChange={(html) => setNotice(html)} />

                        <div>
                            <div className="mb-1 text-xs font-medium text-muted-foreground">プレビュー（実際の表示イメージ）</div>
                            {notice && notice.trim() !== '' ? (
                                <div
                                    className="shift-applications-notice rounded border-l-4 border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900"
                                    dangerouslySetInnerHTML={{ __html: notice }}
                                />
                            ) : (
                                <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">（注意書きは表示されません）</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-6">
                    <Button onClick={save} disabled={saving}>
                        {saving ? '保存中…' : '保存'}
                    </Button>
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppSidebarLayout>
    );
}
