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
        gender: '',
        has_car: false,
        phone_number: '',
        line_name: '',
        memo: '',
        employment_condition: '',
        commute_method: '',
        default_start_time: '',
        default_end_time: '',
        preferred_week_days: [] as string[],
        preferred_week_days_count: '',
        employment_period: '',
        employment_notes: '',
    });

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(route('users.store'), {
            onSuccess: () => reset(),
        });
    };

    // create page は認証情報を別ページで表示するため、ここではコピーロジックを持たない

    const breadcrumbs = [
        { title: 'ユーザー管理', href: route('users.index') },
        { title: '新規作成', href: '' },
    ];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー新規作成" />

            <div className="py-12">
                <div className="mx-auto max-w-4xl sm:px-6 lg:px-8">
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
                                    <Label htmlFor="gender">
                                        性別 <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="male"
                                                checked={data.gender === 'male'}
                                                onChange={() => setData('gender', 'male')}
                                                required
                                            />
                                            <span>男性</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="female"
                                                checked={data.gender === 'female'}
                                                onChange={() => setData('gender', 'female')}
                                            />
                                            <span>女性</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.gender} className="mt-2" />
                                </div>

                                <div>
                                    <Label htmlFor="has_car">
                                        車の有無 <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="has_car"
                                                value="1"
                                                checked={data.has_car === true}
                                                onChange={() => setData('has_car', true)}
                                                required
                                            />
                                            <span>有</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="has_car"
                                                value="0"
                                                checked={data.has_car === false}
                                                onChange={() => setData('has_car', false)}
                                            />
                                            <span>無</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.has_car} className="mt-2" />
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
                                    <Label>採用条件</Label>
                                    <div className="mt-2 flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="employment_condition"
                                                value="dormitory"
                                                checked={data.employment_condition === 'dormitory'}
                                                onChange={() => setData('employment_condition', 'dormitory')}
                                            />
                                            <span>寮</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="employment_condition"
                                                value="commute"
                                                checked={data.employment_condition === 'commute'}
                                                onChange={() => setData('employment_condition', 'commute')}
                                            />
                                            <span>通勤</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="commute_method">通勤方法</Label>
                                    <Input
                                        id="commute_method"
                                        value={data.commute_method}
                                        onChange={(e) => setData('commute_method', e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <div>
                                        <Label htmlFor="default_start_time">基本出勤開始時間</Label>
                                        <Input
                                            id="default_start_time"
                                            type="time"
                                            value={data.default_start_time}
                                            onChange={(e) => setData('default_start_time', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="default_end_time">基本出勤終了時間</Label>
                                        <Input
                                            id="default_end_time"
                                            type="time"
                                            value={data.default_end_time}
                                            onChange={(e) => setData('default_end_time', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="preferred_week_days_count">週休希望日数</Label>
                                    <Input
                                        id="preferred_week_days_count"
                                        type="number"
                                        value={data.preferred_week_days_count}
                                        onChange={(e) => setData('preferred_week_days_count', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label>固定休希望（あれば）</Label>
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                        {[
                                            { value: 'Mon', label: '月' },
                                            { value: 'Tue', label: '火' },
                                            { value: 'Wed', label: '水' },
                                            { value: 'Thu', label: '木' },
                                            { value: 'Fri', label: '金' },
                                            { value: 'Sat', label: '土' },
                                            { value: 'Sun', label: '日' },
                                        ].map((d) => (
                                            <label key={d.value} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={Array.isArray(data.preferred_week_days) && data.preferred_week_days.includes(d.value)}
                                                    onChange={(e) => {
                                                        const arr = Array.isArray(data.preferred_week_days) ? [...data.preferred_week_days] : [];
                                                        if (e.currentTarget.checked) arr.push(d.value);
                                                        else {
                                                            const idx = arr.indexOf(d.value);
                                                            if (idx >= 0) arr.splice(idx, 1);
                                                        }
                                                        setData('preferred_week_days', arr);
                                                    }}
                                                />
                                                <span className="text-xs">{d.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="employment_period">勤務期間</Label>
                                    <Input
                                        id="employment_period"
                                        value={data.employment_period}
                                        onChange={(e) => setData('employment_period', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="employment_notes">勤務備考欄</Label>
                                    <Textarea
                                        id="employment_notes"
                                        rows={3}
                                        value={data.employment_notes}
                                        onChange={(e) => setData('employment_notes', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="memo">その他メモ</Label>
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
