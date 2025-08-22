import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

export default function CreateRolePage() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [processing, setProcessing] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            await axios.post('/api/roles', { name, description });
            router.visit(route('admin.roles'));
        } catch {
            // TODO: show errors
        } finally {
            setProcessing(false);
        }
    };

    const breadcrumbs = [
        { title: '各種設定', href: route('dashboard') },
        { title: 'ロール管理', href: route('admin.roles') },
        { title: '新規作成', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ロール作成" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>新しいロールの情報を入力してください</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="name">名前</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                                </div>

                                {/* <div>
                                    <Label htmlFor="description">説明</Label>
                                    <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                                </div> */}
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Button type="button" variant="outline" onClick={() => router.visit(route('admin.roles'))}>
                                    キャンセル
                                </Button>
                                <Button disabled={processing}>作成</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
