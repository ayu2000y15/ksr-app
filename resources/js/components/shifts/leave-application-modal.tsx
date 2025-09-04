import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import { useForm, usePage } from '@inertiajs/react';
import React from 'react';

export default function LeaveApplicationModal({ open, onOpenChange, date }: { open: boolean; onOpenChange: (v: boolean) => void; date: string }) {
    // use Inertia's page props to get current auth user
    const page = usePage();
    const authUser = (page.props as any)?.auth?.user;

    // minimal payload expected by server: { user_id, date, reason }
    const initial = { user_id: authUser?.id ?? null, date: date || '', type: 'leave', reason: '' };
    const { data, setData, post, processing, errors, reset } = useForm<typeof initial>(initial);

    React.useEffect(() => {
        setData('date', date || '');
    }, [date]);

    React.useEffect(() => {
        if (authUser && authUser.id) setData('user_id', authUser.id);
    }, [authUser]);

    const [toast, setToast] = React.useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        // ensure user_id is present
        if (!data.user_id && authUser && authUser.id) setData('user_id', authUser.id);
        // ensure type defaults to 'leave'
        if (!data.type) setData('type', 'leave');
        post(route('shift-applications.store'), {
            onSuccess: () => {
                reset();
                onOpenChange(false);
                try {
                    // notify parent pages to update local state (date is ISO YYYY-MM-DD)
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('leave:created', { detail: { date: data.date } }));
                    }
                } catch {}
                // show guidance toast
                setToast({ message: '念のためシフト担当者に確認してください', type: 'info' });
                setTimeout(() => setToast(null), 3500);
            },
            onError: (errs) => {
                console.error('申請エラー', errs);
                // show first validation message if present
                if (errs && typeof errs === 'object') {
                    const first = Object.values(errs)[0];
                    if (Array.isArray(first)) alert(String(first[0]));
                    else alert(String(first));
                } else {
                    alert('申請に失敗しました。入力を確認してください。');
                }
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>休暇申請</DialogTitle>
                    </DialogHeader>
                    <div id="leave-application-desc" className="sr-only">
                        日付と理由を入力して休暇申請を行います。
                    </div>

                    <div className="space-y-4 px-4">
                        <div>
                            <Label>日付</Label>
                            {/* 日付はモーダル上で変更不可にする */}
                            <Input type="date" value={data.date} disabled readOnly />
                        </div>
                        <div>
                            <Label>理由</Label>
                            <Textarea value={data.reason} onChange={(e) => setData('reason', e.target.value)} />
                        </div>
                        {/* hidden user_id for server */}
                        <input type="hidden" value={data.user_id ?? ''} />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            キャンセル
                        </Button>
                        <Button disabled={processing} type="submit">
                            申請する
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </Dialog>
    );
}
