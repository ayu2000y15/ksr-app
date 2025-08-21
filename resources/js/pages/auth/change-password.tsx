import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, useForm } from '@inertiajs/react';

export default function ChangePassword() {
    const { data, setData, post, processing, errors } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(route('password.change.store'));
    };

    const breadcrumbs = [
        { title: 'ダッシュボード', href: route('dashboard') },
        { title: 'パスワード変更', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="パスワード変更" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>パスワードを変更してください</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="password">新しいパスワード</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                    />
                                    <InputError message={errors.password} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="password_confirmation">新しいパスワード（確認）</Label>
                                    <Input
                                        id="password_confirmation"
                                        type="password"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                    />
                                    <InputError message={errors.password_confirmation} className="mt-2" />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Button disabled={processing}>変更する</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
