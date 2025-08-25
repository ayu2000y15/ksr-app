import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';

const breadcrumbs = [
    { title: 'シフト管理', href: route('shifts.index') },
    { title: '編集', href: '' },
];

export default function Edit() {
    const pageProps: any = usePage().props;
    const shift = pageProps.shift;

    const { data, setData, post, patch, processing, errors } = useForm({
        user_id: shift.user_id || '',
        date: shift.date || '',
        start_time: shift.start_time || '',
        end_time: shift.end_time || '',
        memo: shift.memo || '',
    });

    const submit = (e: any) => {
        e.preventDefault();
        if (typeof patch === 'function') {
            patch(route('shifts.update', shift.id));
        } else {
            post(route('shifts.update', shift.id), { data: { ...data, _method: 'PATCH' } } as any);
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="シフト編集" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>シフトを編集</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="user_id">ユーザー</Label>
                                    <Input id="user_id" value={data.user_id} onChange={(e) => setData('user_id', e.target.value)} />
                                    <InputError message={errors.user_id} className="mt-2" />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    <div>
                                        <Label htmlFor="date">日付</Label>
                                        <Input id="date" type="date" value={data.date} onChange={(e) => setData('date', e.target.value)} />
                                        <InputError message={errors.date} className="mt-2" />
                                    </div>

                                    <div>
                                        <Label htmlFor="start_time">開始時刻</Label>
                                        <Input
                                            id="start_time"
                                            type="time"
                                            value={data.start_time}
                                            onChange={(e) => setData('start_time', e.target.value)}
                                        />
                                        <InputError message={errors.start_time} className="mt-2" />
                                    </div>

                                    <div>
                                        <Label htmlFor="end_time">終了時刻</Label>
                                        <Input
                                            id="end_time"
                                            type="time"
                                            value={data.end_time}
                                            onChange={(e) => setData('end_time', e.target.value)}
                                        />
                                        <InputError message={errors.end_time} className="mt-2" />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="memo">メモ</Label>
                                    <Textarea id="memo" value={data.memo} onChange={(e) => setData('memo', e.target.value)} />
                                    <InputError message={errors.memo} className="mt-2" />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('shifts.index')}>
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
