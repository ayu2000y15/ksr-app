import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';

export default function EditRolePage() {
    const { props } = usePage();
    // Expect prop `role` passed via server-side Inertia render; if not, fetch
    const initialRole = (props as unknown as { role?: { name?: string; description?: string } }).role || null;
    const [name, setName] = useState(initialRole?.name || '');
    const [description, setDescription] = useState(initialRole?.description || '');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!initialRole) {
            // attempt to fetch from current url
            const segments = window.location.pathname.split('/');
            const id = segments[segments.length - 2] === 'roles' ? segments[segments.length - 1] : segments[segments.length - 2];
            axios.get(`/api/roles/${id}`).then((res) => {
                setName(res.data.name);
                setDescription(res.data.description || '');
            });
        }
    }, [initialRole]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            // compute id from path
            const segments = window.location.pathname.split('/');
            const id = segments[segments.length - 2] === 'roles' ? segments[segments.length - 1] : segments[segments.length - 2];
            await axios.put(`/api/roles/${id}`, { name, description });
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
        { title: '編集', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ロール編集" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>ロール情報を編集してください</CardTitle>
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
                                <Button disabled={processing}>更新</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
