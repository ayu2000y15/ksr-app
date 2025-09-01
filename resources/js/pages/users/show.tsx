import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, Link } from '@inertiajs/react';
import { Car } from 'lucide-react';

export default function Show({ user, properties }: { user: any; properties: any[] }) {
    const breadcrumbs = [{ title: 'ユーザー管理', href: route('users.index') }, { title: '詳細' }];

    const weekdayMap = { Mon: '月', Tue: '火', Wed: '水', Thu: '木', Fri: '金', Sat: '土', Sun: '日' } as Record<string, string>;

    const preferredDays = Array.isArray(user.preferred_week_days)
        ? user.preferred_week_days
        : user.preferred_week_days
          ? JSON.parse(user.preferred_week_days)
          : [];

    const formatDate = (iso?: string | null) => {
        if (!iso) return '—';
        try {
            const s = String(iso).trim();
            // prefer simple yyyy-mm-dd -> yyyy/mm/dd
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return `${m[1]}/${m[2]}/${m[3]}`;
            // already in yyyy/mm/dd or other parseable form
            const d = new Date(s.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${y}/${mm}/${dd}`;
            }
            return s;
        } catch {
            return String(iso);
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={`ユーザー: ${user.name}`} />
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-lg font-medium">ユーザー詳細</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => window.history.back()} title="前のページへ戻る">
                            戻る
                        </Button>
                        <Link href={route('users.edit', user.id)}>
                            <Button>編集</Button>
                        </Link>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {user.name} (ID: {user.id})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                                <div className="text-sm text-muted-foreground">採用条件</div>
                                <div className="font-medium">
                                    {user.employment_condition === 'dormitory' ? '寮' : user.employment_condition === 'commute' ? '通勤' : '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">通勤方法</div>
                                <div className="font-medium">{user.commute_method || '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">基本出勤時間</div>
                                <div className="font-medium">
                                    {user.default_start_time || '—'} 〜 {user.default_end_time || '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">週休希望日数</div>
                                <div className="font-medium">{user.preferred_week_days_count ?? '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">固定休希望</div>
                                <div className="font-medium">{preferredDays.map((d: string) => weekdayMap[d] || d).join(' ') || '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">勤務期間</div>
                                <div className="font-medium">{user.employment_period || '—'}</div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <div className="text-sm text-muted-foreground">勤務備考</div>
                                <div className="whitespace-pre-line">{user.employment_notes || '—'}</div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <div className="text-sm text-muted-foreground">メモ</div>
                                <div className="whitespace-pre-line">{user.memo || '—'}</div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="text-sm font-medium">関連物件</div>
                            {properties && properties.length > 0 ? (
                                properties.map((p: unknown) => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const prop = p as any; // minimal cast for render
                                    return (
                                        <div key={prop.property.id} className="mt-3 rounded border p-3">
                                            <div className="font-medium">{prop.property.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                不動産会社: {prop.property.real_estate_agent ? prop.property.real_estate_agent.name : '—'}
                                            </div>
                                            <div className="text-sm">郵便番号: {prop.property.postcode || '—'}</div>
                                            <div className="text-sm">住所: {prop.property.address || '—'}</div>
                                            <div className="text-sm">駐車場: {prop.property.has_parking ? 'あり' : 'なし'}</div>

                                            <div className="mt-2 text-sm font-medium">入居情報</div>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {prop.occupancies.map((occ: any) => (
                                                <div key={occ.id} className="mt-1 ml-2">
                                                    <div>入寮日: {formatDate(occ.move_in_date)}</div>
                                                    <div>退寮日: {occ.move_out_date ? formatDate(occ.move_out_date) : '—'}</div>
                                                    {occ.cohabitants && occ.cohabitants.length > 0 ? (
                                                        <div className="mt-2">
                                                            <div className="text-sm text-muted-foreground">同居ユーザー</div>
                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                {occ.cohabitants.map((c: any) => (
                                                                     
                                                                    <Badge
                                                                        key={c.id}
                                                                        className="inline-flex items-center gap-2 bg-gray-200 text-black"
                                                                    >
                                                                        {c.name}
                                                                        {c.has_car ? <Car className="h-3 w-3 text-violet-600" /> : null}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="mt-2 text-sm text-muted-foreground">該当物件なし</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
