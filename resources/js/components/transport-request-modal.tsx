import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import Toast from '@/components/ui/toast';
import { usePage } from '@inertiajs/react';
import axios, { AxiosError } from 'axios';
import { FormEvent, useEffect, useState } from 'react';

type Props = {
    dateIso: string;
    trigger?: React.ReactNode;
    onSuccess?: (message: string) => void;
};

export default function TransportRequestModal({ dateIso, trigger, onSuccess }: Props) {
    const [open, setOpen] = useState(false);
    const [direction, setDirection] = useState<'to' | 'from' | ''>('to');
    const [driverIds, setDriverIds] = useState<number[]>([]);
    type OptionType = { label: string; value: number; disabled?: boolean };
    const [options, setOptions] = useState<OptionType[]>([]);
    const [processing, setProcessing] = useState(false);
    type ToastState = { message: string; type: 'success' | 'error' } | null;
    const [toast, setToast] = useState<ToastState>(null);
    const [serverMessage, setServerMessage] = useState<string | null>(null);
    const [userHasTo, setUserHasTo] = useState(false);
    const [userHasFrom, setUserHasFrom] = useState(false);
    const [blockedForTo, setBlockedForTo] = useState<number[]>([]);
    const [blockedForFrom, setBlockedForFrom] = useState<number[]>([]);
    const page = usePage();
    // type-safe extraction of auth.user.id from page.props
    type PagePropsType = { auth?: { user?: { id?: number | null } } };
    const pageProps = page.props as PagePropsType;
    const authUserId = pageProps?.auth?.user?.id ?? null;

    // load options for user select lazily from server? For now, we'll let the combobox fetch as needed.
    // The SingleSelectCombobox used elsewhere accepts `options` and `onChange`.

    // determine submit action route (fallback to /api/transport-requests if Ziggy route not available)
    let submitAction = '/api/transport-requests';
    try {
        // If Ziggy's `route` helper exists, use it — otherwise fallback to the API path
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        submitAction = typeof route === 'function' ? route('transport-requests.store') : submitAction;
    } catch {
        // keep fallback
    }

    useEffect(() => {
        // reset when opened and fetch users
        if (open) {
            // initialize direction only when modal is opened
            setDirection('to');
            setDriverIds([]);
            setUserHasTo(false);
            setUserHasFrom(false);
            (async () => {
                try {
                    const res = await axios.get('/api/active-users');
                    const list = (res.data && res.data.users) || res.data || [];
                    type UserShape = { id: number | string; name?: string; has_car?: number | boolean };
                    const opts = Array.isArray(list)
                        ? (list as UserShape[])
                              .filter((u) => u && u.id != null && (u.has_car === 0 || u.has_car === false))
                              .map((u) => ({ label: `${u.id} ${u.name || ''}`, value: Number(u.id) }))
                        : [];
                    setOptions(opts);
                } catch {
                    setOptions([]);
                }
                // fetch existing transport requests for this date and compute if current user already applied
                try {
                    const res2 = await axios.get('/api/transport-requests', { params: { date: dateIso } });
                    const trs = (res2.data && res2.data.transport_requests) || [];
                    if (Array.isArray(trs)) {
                        type TR = { created_by?: number | string; direction?: string; driver_ids?: number[] | string[] };
                        const arr = trs as TR[];
                        // compute blocked ids per direction
                        const blockedTo: number[] = [];
                        const blockedFrom: number[] = [];
                        arr.forEach((t) => {
                            const dlist = Array.isArray(t.driver_ids) ? t.driver_ids.map((x) => Number(x)) : [];
                            if (String(t.direction) === 'to') dlist.forEach((id) => blockedTo.push(id));
                            if (String(t.direction) === 'from') dlist.forEach((id) => blockedFrom.push(id));
                        });
                        setBlockedForTo(Array.from(new Set(blockedTo)));
                        setBlockedForFrom(Array.from(new Set(blockedFrom)));

                        if (authUserId != null) {
                            const hasTo = arr.some((t) => Number(t.created_by) === Number(authUserId) && String(t.direction) === 'to');
                            const hasFrom = arr.some((t) => Number(t.created_by) === Number(authUserId) && String(t.direction) === 'from');
                            setUserHasTo(Boolean(hasTo));
                            setUserHasFrom(Boolean(hasFrom));
                            // decide initial direction without referencing the current `direction` variable
                            if (hasTo && hasFrom) {
                                setDirection('');
                            } else if (hasTo && !hasFrom) {
                                setDirection('from');
                            } else if (hasFrom && !hasTo) {
                                setDirection('to');
                            } else {
                                setDirection('to');
                            }
                        }
                    }
                } catch {
                    // ignore
                }
            })();
        }
    }, [open, authUserId, dateIso]);

    // update options to include disabled flag depending on selected direction
    useEffect(() => {
        const blocked = direction === 'to' ? blockedForTo : blockedForFrom;
        setOptions((prev) => prev.map((o) => ({ ...o, disabled: blocked.includes(o.value) })));
    }, [direction, blockedForTo, blockedForFrom]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger ? trigger : <Button>送迎申請</Button>}</DialogTrigger>
            <DialogContent>
                <DialogTitle>送迎申請</DialogTitle>
                <DialogDescription>送迎の申請を作成します。日付は変更できません。</DialogDescription>

                <form
                    onSubmit={async (e: FormEvent) => {
                        e.preventDefault();
                        if (!direction || driverIds.length === 0) return;
                        setProcessing(true);
                        try {
                            const payload = {
                                date: dateIso,
                                direction,
                                driver_ids: driverIds,
                            };
                            const res = await axios.post(submitAction, payload);
                            const json = res.data || {};
                            const msg = (json && json.message) || '送迎申請を作成しました';
                            // close modal first, then notify parent so the parent (dashboard) can show the toast
                            setOpen(false);
                            if (onSuccess) {
                                try {
                                    onSuccess(msg);
                                } catch {
                                    // ignore
                                }
                            } else {
                                // fallback to modal-local toast if no parent handler provided
                                setToast({ message: msg, type: 'success' });
                                setTimeout(() => setToast(null), 3500);
                            }
                        } catch (err) {
                            const aerr = err as AxiosError | undefined;
                            type ErrData = { message?: string };
                            const txt = (aerr && (aerr.response?.data as ErrData)?.message) || aerr?.message || '送信に失敗しました';
                            // if validation conflict (422), show message inside modal
                            if (aerr && aerr.response && aerr.response.status === 422) {
                                setServerMessage(String(txt));
                            } else {
                                setToast({ message: String(txt), type: 'error' });
                                setTimeout(() => setToast(null), 5000);
                            }
                        } finally {
                            setProcessing(false);
                        }
                    }}
                    className="space-y-4"
                >
                    <div>
                        <Label>日付</Label>
                        {/* visually disabled and not focusable */}
                        <Input disabled value={dateIso} className="cursor-default bg-gray-50 text-muted-foreground" />
                    </div>

                    <div>
                        <Label>種別</Label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="direction"
                                    value="to"
                                    checked={direction === 'to'}
                                    onChange={() => setDirection('to')}
                                    disabled={userHasTo}
                                />
                                行き{userHasTo ? '（既に申請済）' : ''}
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="direction"
                                    value="from"
                                    checked={direction === 'from'}
                                    onChange={() => setDirection('from')}
                                    disabled={userHasFrom}
                                />
                                帰り{userHasFrom ? '（既に申請済）' : ''}
                            </label>
                        </div>
                    </div>

                    <div>
                        <Label>送迎した人</Label>
                        <MultiSelectCombobox
                            options={options}
                            selected={driverIds}
                            onChange={(vals) => setDriverIds(vals)}
                            placeholder="ユーザーを検索して選択"
                        />
                        <div className="mt-1 text-xs text-muted-foreground">車を所持しているユーザーは選択できません。</div>
                        {(userHasTo || userHasFrom) && (
                            <div className="mt-1 text-xs text-muted-foreground">
                                あなたはこの日の{userHasTo ? '行き' : ''}
                                {userHasTo && userHasFrom ? '・' : ''}
                                {userHasFrom ? '帰り' : ''}を既に申請しています。
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={processing || !direction || driverIds.length === 0}>
                            申請する
                        </Button>
                    </DialogFooter>
                </form>
                {serverMessage && <div className="mt-2 text-sm text-red-600">{serverMessage}</div>}
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </DialogContent>
        </Dialog>
    );
}
