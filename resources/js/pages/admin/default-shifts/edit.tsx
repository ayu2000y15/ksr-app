import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';

export default function Edit() {
    const page: any = usePage();
    const defaultShift = page.props.default_shift;

    const { data, setData, patch, processing, errors } = useForm({
        name: defaultShift.name || '',
        type: defaultShift.type || 'weekday',
        day_of_week: defaultShift.day_of_week || 0,
        shift_type: defaultShift.shift_type || 'day',
        start_time: defaultShift.start_time || '09:00',
        end_time: defaultShift.end_time || '18:00',
    });

    const submit = (e: any) => {
        e.preventDefault();
        if (typeof patch === 'function') {
            patch(route('admin.default-shifts.update', defaultShift.id));
        }
    };

    const breadcrumbs = [
        { title: 'ダッシュボード', href: route('dashboard') },
        { title: '各種設定', href: route('admin.role-permissions') },
        { title: 'デフォルトシフト設定', href: route('admin.default-shifts.index') },
        { title: '編集', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="デフォルトシフト編集" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>デフォルトシフトを編集してください</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="name">
                                        パターン名 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    <InputError message={errors.name} className="mt-2" />
                                </div>

                                <div>
                                    <div className="mb-2 text-sm font-medium">曜日</div>
                                    <div className="mb-2">{['日', '月', '火', '水', '木', '金', '土'][data.day_of_week]}</div>
                                    <Input id="day_of_week" type="hidden" value={String(data.day_of_week)} />
                                    <InputError message={errors.day_of_week} className="mt-2" />
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <div className="mb-2 text-sm font-medium">種別</div>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="type"
                                                    checked={data.type === 'weekday'}
                                                    onChange={() => setData('type', 'weekday')}
                                                />
                                                <span>平日</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="type"
                                                    checked={data.type === 'holiday'}
                                                    onChange={() => setData('type', 'holiday')}
                                                />
                                                <span>休日</span>
                                            </label>
                                        </div>
                                        <InputError message={errors.type} className="mt-2" />
                                    </div>

                                    <div>
                                        <div className="mb-2 text-sm font-medium">勤務帯</div>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="shift_type"
                                                    checked={data.shift_type === 'day'}
                                                    onChange={() => setData('shift_type', 'day')}
                                                />
                                                <span>昼</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="shift_type"
                                                    checked={data.shift_type === 'night'}
                                                    onChange={() => setData('shift_type', 'night')}
                                                />
                                                <span>夜</span>
                                            </label>
                                        </div>
                                        <InputError message={errors.shift_type} className="mt-2" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="start_time">開始時間</Label>
                                            <Input
                                                id="start_time"
                                                type="time"
                                                value={data.start_time}
                                                onChange={(e) => setData('start_time', e.target.value)}
                                            />
                                            <InputError message={errors.start_time} className="mt-2" />
                                        </div>
                                        <div>
                                            <Label htmlFor="end_time">終了時間</Label>
                                            <Input
                                                id="end_time"
                                                type="time"
                                                value={data.end_time}
                                                onChange={(e) => setData('end_time', e.target.value)}
                                            />
                                            <InputError message={errors.end_time} className="mt-2" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('admin.default-shifts.index')}>
                                    <Button variant="outline" type="button">
                                        キャンセル
                                    </Button>
                                </Link>
                                <Button disabled={processing}>更新する</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
