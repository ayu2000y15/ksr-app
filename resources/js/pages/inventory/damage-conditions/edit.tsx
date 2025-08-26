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
    const page = usePage();
    const props = page.props as unknown as { damage_condition?: { id?: number; condition?: string; order_column?: number }; flash?: unknown };
    const item = props.damage_condition || null;

    const { data, setData, patch, processing, errors } = useForm({ condition: '', order_column: 0 });

    useEffect(() => {
        if (!item) return;
        setData('condition', item.condition ?? '');
        setData('order_column', typeof item.order_column !== 'undefined' && item.order_column !== null ? item.order_column : 0);
    }, [item, setData]);

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!item || !item.id) return;
    patch(route('inventory.damage-conditions.update', item.id));
    };

    const breadcrumbs = [
        { title: '在庫管理', href: route('inventory.index') },
        { title: '破損状態', href: route('inventory.damage-conditions.index') },
        { title: '編集', href: '' },
    ];

    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        const flash = props.flash as unknown as { success?: string; error?: string } | undefined;
        if (flash && (flash.success || flash.error)) {
            setToast(flash.success ? { message: flash.success, type: 'success' } : { message: flash.error || '', type: 'error' });
        }
    }, [props.flash]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="破損状態 編集" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>破損状態を編集してください</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="condition">
                                        状態 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="condition" value={data.condition} onChange={(e) => setData('condition', e.target.value)} required />
                                    <InputError message={errors.condition} className="mt-2" />
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
                                <Link href={route('inventory.damage-conditions.index')}>
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
