import InputError from '@/components/input-error'; // 修正
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// ...existing code...
import { Textarea } from '@/components/ui/textarea';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
// ...existing code...
import { Head, Link, useForm } from '@inertiajs/react';

export default function Create() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        status: 'active',
        phone_number: '',
        line_name: '',
        memo: '',
    });

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(route('users.store'), {
            onSuccess: () => reset(),
        });
    };

    // create page は認証情報を別ページで表示するため、ここではコピーロジックを持たない

    const breadcrumbs = [
        { title: 'ダッシュボード', href: route('dashboard') },
        { title: 'ユーザー管理', href: route('users.index') },
        { title: '新規作成', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー新規作成" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>新しいユーザーの情報を入力してください</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="name">
                                        名前 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    <InputError message={errors.name} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="email">
                                        メールアドレス <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} required />
                                    <InputError message={errors.email} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="status">
                                        ステータス <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="active"
                                                checked={data.status === 'active'}
                                                onChange={() => setData('status', 'active')}
                                            />
                                            <span>アクティブ</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="retired"
                                                checked={data.status === 'retired'}
                                                onChange={() => setData('status', 'retired')}
                                            />
                                            <span>退職</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="shared"
                                                checked={data.status === 'shared'}
                                                onChange={() => setData('status', 'shared')}
                                            />
                                            <span>共有アカウント</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.status} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="phone_number">電話番号</Label>
                                    <Input id="phone_number" value={data.phone_number} onChange={(e) => setData('phone_number', e.target.value)} />
                                    <InputError message={errors.phone_number} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="line_name">LINE名</Label>
                                    <Input id="line_name" value={data.line_name} onChange={(e) => setData('line_name', e.target.value)} />
                                    <InputError message={errors.line_name} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="memo">メモ</Label>
                                    <Textarea id="memo" value={data.memo} onChange={(e) => setData('memo', e.target.value)} />
                                    <InputError message={errors.memo} className="mt-2" />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('users.index')}>
                                    <Button variant="outline" type="button">
                                        キャンセル
                                    </Button>
                                </Link>
                                <Button disabled={processing}>登録する</Button>
                            </CardFooter>
                        </Card>
                    </form>

                    {/* 登録完了の認証情報は専用ページに表示するため、ここでは表示しない */}
                </div>
            </div>
        </AppSidebarLayout>
    );
}
