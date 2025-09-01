import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Create() {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '', order_column: 0, color: '#2f80ed' });

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(route('tasks.categories.store'), {
            onSuccess: () => reset(),
        });
    };

    const breadcrumbs = [
        { title: 'タスク管理', href: route('tasks.index') },
        { title: 'タスクカテゴリ', href: route('tasks.categories.index') },
        { title: '新規作成', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="カテゴリ新規作成" />
            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>新しいカテゴリを作成してください</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="name">
                                        名称 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    <InputError message={errors.name} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="order_column">
                                        並び順 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="order_column"
                                        type="number"
                                        value={String(data.order_column ?? 0)}
                                        onChange={(e) => setData('order_column', Number(e.target.value || 0))}
                                        min={0}
                                        step={1}
                                        required
                                    />
                                    <InputError message={errors.order_column} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="color">色</Label>
                                    <input
                                        id="color"
                                        type="color"
                                        value={data.color}
                                        onChange={(e) => setData('color', e.target.value)}
                                        className="h-8 w-12 rounded border p-0"
                                    />
                                    <InputError message={errors.color} className="mt-2" />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('tasks.categories.index')}>
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
