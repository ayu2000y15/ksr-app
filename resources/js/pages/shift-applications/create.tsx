import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import React from 'react';

const breadcrumbs = [
    { title: '休暇申請', href: route('shift-applications.index') },
    { title: '新規申請', href: '' },
];

export default function Create() {
    const { data, setData, post, processing, errors, reset } = useForm({
        start_at: '',
        end_at: '',
        reason: '',
    });

    const [toast, setToast] = React.useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(route('shift-applications.store'), {
            onSuccess: () => {
                reset();
                setToast({ message: '念のためシフト担当者に確認してください', type: 'info' });
                setTimeout(() => setToast(null), 3500);
            },
        });
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="休暇申請 - 新規" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>休暇を申請</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="start_at">開始日</Label>
                                    <Input id="start_at" type="date" value={data.start_at} onChange={(e) => setData('start_at', e.target.value)} />
                                    <InputError message={errors.start_at} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="end_at">終了日</Label>
                                    <Input id="end_at" type="date" value={data.end_at} onChange={(e) => setData('end_at', e.target.value)} />
                                    <InputError message={errors.end_at} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="reason">理由</Label>
                                    <Textarea id="reason" value={data.reason} onChange={(e) => setData('reason', e.target.value)} />
                                    <InputError message={errors.reason} className="mt-2" />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('shift-applications.index')}>
                                    <Button variant="outline" type="button">
                                        キャンセル
                                    </Button>
                                </Link>
                                <Button disabled={processing}>申請する</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppSidebarLayout>
    );
}
