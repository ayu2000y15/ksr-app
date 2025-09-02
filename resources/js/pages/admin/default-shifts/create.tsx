import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function Create() {
    const initialEntries = Array.from({ length: 7 }).map((_, i) => ({
        day_of_week: i,
        type: 'weekday',
        shift_type: 'day',
        start_time: '09:00',
        end_time: '18:00',
    }));

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        entries: initialEntries,
    });

    const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
    const [selectedDay, setSelectedDay] = useState<number>(0);

    const submit = (e: any) => {
        e.preventDefault();

        if (mode === 'single') {
            const originalEntries = data.entries || [];
            const filtered = originalEntries.filter((ent: any) => ent.day_of_week === selectedDay);
            // フォーム state を直接書き換えず、フィルタ済みデータを明示的に送信する
            router.post(
                route('admin.default-shifts.store'),
                { name: data.name, entries: filtered },
                {
                    onFinish: () => {
                        // 何もしない（form state はそのまま）
                    },
                },
            );
            return;
        }

        post(route('admin.default-shifts.store'));
    };

    const breadcrumbs = [
        { title: '各種設定', href: route('admin.role-permissions') },
        { title: 'デフォルトシフト設定', href: route('admin.default-shifts.index') },
        { title: '新規作成', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="デフォルトシフト作成" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>デフォルトシフトの情報を入力してください</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="name">
                                        パターン名 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    <InputError message={errors.name} className="mt-2" />
                                </div>

                                <div className="space-y-4">
                                    {/* モード切替: 複数曜日まとめて登録 / 単体登録 */}
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="mode" defaultChecked onChange={() => setMode('bulk')} />
                                            <span className="text-sm">曜日まとめて登録</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="mode" onChange={() => setMode('single')} />
                                            <span className="text-sm">単体登録</span>
                                        </label>
                                        {mode === 'single' && (
                                            <select
                                                className="ml-2 rounded border px-2 py-1"
                                                value={selectedDay}
                                                onChange={(e) => setSelectedDay(Number(e.target.value))}
                                            >
                                                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                                                    <option key={d} value={d}>
                                                        {['日', '月', '火', '水', '木', '金', '土'][d]}曜日
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {([0, 1, 2, 3, 4, 5, 6] as number[])
                                        .filter((d) => (mode === 'bulk' ? true : d === selectedDay))
                                        .map((day) => {
                                            const shifts = data.entries
                                                .map((e: any, ei: number) => ({ ...e, __idx: ei }))
                                                .filter((e: any) => e.day_of_week === day);
                                            return (
                                                <div key={day} className="rounded border p-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-medium">{['日', '月', '火', '水', '木', '金', '土'][day]}曜日</div>
                                                        <div className="text-sm text-muted-foreground">({day})</div>
                                                    </div>

                                                    <div className="mt-3 space-y-3">
                                                        {shifts.length === 0 && (
                                                            <div className="text-sm text-muted-foreground">
                                                                この曜日のシフトはまだありません。追加してください。
                                                            </div>
                                                        )}

                                                        {shifts.map((entry: any) => (
                                                            <div key={entry.__idx} className="rounded border p-2">
                                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center">
                                                                        <div className="w-full">
                                                                            <div className="mb-2 text-sm font-medium">種別</div>
                                                                            <div className="flex items-center gap-4">
                                                                                <label className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="radio"
                                                                                        name={`type_${entry.__idx}`}
                                                                                        checked={entry.type === 'weekday'}
                                                                                        onChange={() => {
                                                                                            const copy = [...data.entries];
                                                                                            copy[entry.__idx] = {
                                                                                                ...copy[entry.__idx],
                                                                                                type: 'weekday',
                                                                                            };
                                                                                            setData('entries', copy);
                                                                                        }}
                                                                                    />
                                                                                    <span>平日</span>
                                                                                </label>
                                                                                <label className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="radio"
                                                                                        name={`type_${entry.__idx}`}
                                                                                        checked={entry.type === 'holiday'}
                                                                                        onChange={() => {
                                                                                            const copy = [...data.entries];
                                                                                            copy[entry.__idx] = {
                                                                                                ...copy[entry.__idx],
                                                                                                type: 'holiday',
                                                                                            };
                                                                                            setData('entries', copy);
                                                                                        }}
                                                                                    />
                                                                                    <span>休日</span>
                                                                                </label>
                                                                            </div>
                                                                        </div>

                                                                        <div className="w-full">
                                                                            <div className="mb-2 text-sm font-medium">勤務帯</div>
                                                                            <div className="flex items-center gap-4">
                                                                                <label className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="radio"
                                                                                        name={`shift_${entry.__idx}`}
                                                                                        checked={entry.shift_type === 'day'}
                                                                                        onChange={() => {
                                                                                            const copy = [...data.entries];
                                                                                            copy[entry.__idx] = {
                                                                                                ...copy[entry.__idx],
                                                                                                shift_type: 'day',
                                                                                            };
                                                                                            setData('entries', copy);
                                                                                        }}
                                                                                    />
                                                                                    <span>昼</span>
                                                                                </label>
                                                                                <label className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="radio"
                                                                                        name={`shift_${entry.__idx}`}
                                                                                        checked={entry.shift_type === 'night'}
                                                                                        onChange={() => {
                                                                                            const copy = [...data.entries];
                                                                                            copy[entry.__idx] = {
                                                                                                ...copy[entry.__idx],
                                                                                                shift_type: 'night',
                                                                                            };
                                                                                            setData('entries', copy);
                                                                                        }}
                                                                                    />
                                                                                    <span>夜</span>
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex-shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            className="text-sm text-red-600"
                                                                            onClick={() => {
                                                                                if (!confirm('このシフトを削除しますか？')) return;
                                                                                const copy = [...data.entries];
                                                                                copy.splice(entry.__idx, 1);
                                                                                setData('entries', copy);
                                                                            }}
                                                                        >
                                                                            削除
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <Label>開始</Label>
                                                                        <Input
                                                                            type="time"
                                                                            value={entry.start_time}
                                                                            onChange={(e) => {
                                                                                const copy = [...data.entries];
                                                                                copy[entry.__idx] = {
                                                                                    ...copy[entry.__idx],
                                                                                    start_time: e.target.value,
                                                                                };
                                                                                setData('entries', copy);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <Label>終了</Label>
                                                                        <Input
                                                                            type="time"
                                                                            value={entry.end_time}
                                                                            onChange={(e) => {
                                                                                const copy = [...data.entries];
                                                                                copy[entry.__idx] = {
                                                                                    ...copy[entry.__idx],
                                                                                    end_time: e.target.value,
                                                                                };
                                                                                setData('entries', copy);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        <div>
                                                            <button
                                                                type="button"
                                                                className="mt-2 text-sm text-blue-600"
                                                                onClick={() => {
                                                                    const copy = [...data.entries];
                                                                    copy.push({
                                                                        day_of_week: day,
                                                                        type: 'weekday',
                                                                        shift_type: 'day',
                                                                        start_time: '09:00',
                                                                        end_time: '18:00',
                                                                    });
                                                                    setData('entries', copy);
                                                                }}
                                                            >
                                                                シフトを追加
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('admin.default-shifts.index')}>
                                    <Button variant="outline" type="button">
                                        キャンセル
                                    </Button>
                                </Link>
                                <Button disabled={processing}>登録する</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
