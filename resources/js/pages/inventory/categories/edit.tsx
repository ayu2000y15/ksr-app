import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function Edit() {
    const page: any = usePage().props;
    const category = page.inventory_category || page.category || page.categoryData || null;

    // initialize with safe defaults; populate when `category` prop arrives
    const { data, setData, patch, processing, errors } = useForm({ name: '', order_column: 0 });

    // populate form when server prop becomes available (prevents empty fields on client navigation)
    useEffect(() => {
        if (!category) return;
        setData('name', category.name ?? '');
        setData('order_column', typeof category.order_column !== 'undefined' && category.order_column !== null ? category.order_column : 0);
    }, [category, setData]);

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!category || !category.id) return;
        patch(route('inventory.categories.update', category.id));
    };

    const breadcrumbs = [
        { title: '在庫管理', href: route('inventory.index') },
        { title: '在庫カテゴリ', href: route('inventory.categories.index') },
        { title: '編集', href: '' },
    ];

    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        if ((page.flash && page.flash.success) || (page.flash && page.flash.error)) {
            setToast(page.flash.success ? { message: page.flash.success, type: 'success' } : { message: page.flash.error, type: 'error' });
        }
    }, [page.flash]);

    // debug: log page props to console so we can verify server-provided data
    useEffect(() => {
        try {
            // `page` is the Inertia page props object (we log to find the key containing category)
            // eslint-disable-next-line no-console
            console.log('inertia page props (inventory category edit):', page);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('failed to log page props', e);
        }
    }, [page]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="カテゴリ編集" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>カテゴリ情報を編集してください</CardTitle>
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
                            </CardContent>
                            <CardFooter className="flex justify-end gap-4">
                                <Link href={route('inventory.categories.index')}>
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
