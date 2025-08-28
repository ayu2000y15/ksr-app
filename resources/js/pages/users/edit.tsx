import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// ...existing code...
import { Textarea } from '@/components/ui/textarea';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { User } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

// パンくずリスト
const breadcrumbs = [
    { title: 'ユーザー管理', href: route('users.index') },
    { title: '編集', href: '' },
];

export default function EditUserPage() {
    const pageProps: any = usePage().props;
    const flash = pageProps.flash || null;
    const user: User = pageProps.user;
    const credentials = pageProps.credentials || (flash && flash.credentials) || null;

    const { data, setData, post, patch, processing, errors } = useForm({
        name: user.name || '',
        email: user.email || '',
        status: user.status || 'active',
        gender: user.gender ?? '',
        has_car: typeof user.has_car === 'boolean' ? user.has_car : false,
        phone_number: user.phone_number || '',
        line_name: user.line_name || '',
        memo: user.memo || '',
    });

    const submit = (e: any) => {
        e.preventDefault();
        // users.update route expects PATCH
        if (typeof patch === 'function') {
            patch(route('users.update', user.id));
        } else {
            // fallback to post with method override by including _method in payload
            // cast to any to satisfy useForm typings
            post(route('users.update', user.id), { data: { ...data, _method: 'PATCH' } } as any);
        }
    };

    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(
        flash && flash.success ? { message: flash.success, type: 'success' } : flash && flash.error ? { message: flash.error, type: 'error' } : null,
    );

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            console.error('コピーに失敗しました');
        }
    };

    // restore sent flag by strictly matching stored credentials to current credentials — only when credentials exist
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const sentKey = `user_credentials_sent_${user.email}`;

            if (!credentials) {
                // if we don't have credentials to show, never restore sent (avoid blocking send button)
                setSent(false);
                return;
            }

            // Prefer direct stored creds for this user.email
            const credKey = `user_credentials_${user.email}`;
            const stored = sessionStorage.getItem(credKey);

            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    const sameEmail = parsed && parsed.email && credentials.email && parsed.email.toLowerCase() === credentials.email.toLowerCase();
                    const sameTemp =
                        parsed &&
                        parsed.temporary_password &&
                        credentials.temporary_password &&
                        parsed.temporary_password === credentials.temporary_password;
                    if (sameEmail && sameTemp) {
                        setSent(sessionStorage.getItem(sentKey) === '1');
                        return;
                    }
                } catch {
                    // fall through to clear
                }
            }

            // No matching stored credentials -> clear sent
            sessionStorage.removeItem(sentKey);
            setSent(false);
        } catch {
            // ignore
        }
    }, [user.email, credentials]);

    // prepare display values: always show name/email; temporary password kept in state so we can update it
    const displayName = credentials?.name ?? user.name ?? '';
    const displayEmail = credentials?.email ?? user.email ?? '';
    const [displayTemp, setDisplayTemp] = useState<string | null>(credentials?.temporary_password ?? null);
    const [regenerating, setRegenerating] = useState(false);

    useEffect(() => {
        // if credentials prop provides a temp password, use it
        if (credentials && credentials.temporary_password) {
            setDisplayTemp(credentials.temporary_password);
            return;
        }

        // otherwise try to find a stored temporary password for this email in sessionStorage
        if (typeof window === 'undefined') return;
        try {
            const key = `user_credentials_${displayEmail}`;
            const stored = sessionStorage.getItem(key);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.temporary_password) {
                        setDisplayTemp(parsed.temporary_password);
                        return;
                    }
                } catch {
                    // ignore parse errors
                }
            }

            // scan entries as fallback
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (!k) continue;
                if (!k.startsWith('user_credentials_')) continue;
                try {
                    const v = sessionStorage.getItem(k);
                    if (!v) continue;
                    const parsed = JSON.parse(v);
                    if (
                        parsed &&
                        parsed.email &&
                        String(parsed.email).toLowerCase() === String(displayEmail).toLowerCase() &&
                        parsed.temporary_password
                    ) {
                        setDisplayTemp(parsed.temporary_password);
                        break;
                    }
                } catch {
                    // ignore parse errors
                }
            }
        } catch {
            // ignore
        }
    }, [credentials, displayEmail]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ユーザー編集" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    <form onSubmit={submit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>ユーザー情報を編集してください</CardTitle>
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
                                <Button disabled={processing}>更新する</Button>
                            </CardFooter>
                        </Card>
                    </form>

                    {/* must_change_password が true の場合、パスワード未変更の注意と認証情報を表示 */}
                    {user.must_change_password && (
                        <div className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>登録完了 - ログイン情報（未パスワード変更）</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="mb-2">このアカウントは初回ログイン時にパスワード変更が必要です。</p>
                                    <div className="space-y-2">
                                        <div>
                                            <div className="mb-2">
                                                <Label>メールアドレス</Label>
                                                <div className="rounded-md bg-gray-100 p-2">{displayEmail}</div>
                                            </div>
                                            <div>
                                                <Label>仮パスワード</Label>
                                                <div className="rounded-md bg-gray-100 p-2 font-mono">{displayTemp ?? '（表示できません）'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex items-center justify-between">
                                    <div>
                                        <Button
                                            variant="ghost"
                                            title="仮パスワードが表示されない場合は再作成します"
                                            onClick={async () => {
                                                if (regenerating) return;
                                                setRegenerating(true);
                                                try {
                                                    const metaToken =
                                                        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                                    const xsrfCookie = (document.cookie || '').split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
                                                    const xsrfValue = xsrfCookie ? decodeURIComponent(xsrfCookie.split('=')[1]) : '';

                                                    const res = await fetch(route('users.credentials.regenerate', user.id), {
                                                        method: 'POST',
                                                        credentials: 'include',
                                                        headers: {
                                                            Accept: 'application/json',
                                                            'X-Requested-With': 'XMLHttpRequest',
                                                            'Content-Type': 'application/json',
                                                            'X-CSRF-TOKEN': metaToken,
                                                            'X-XSRF-TOKEN': xsrfValue,
                                                        },
                                                    });
                                                    let json = null;
                                                    try {
                                                        json = await res.json();
                                                    } catch {
                                                        // ignore
                                                    }
                                                    if (res.ok && json && json.temporary_password) {
                                                        setDisplayTemp(json.temporary_password);
                                                        try {
                                                            const key = `user_credentials_${displayEmail}`;
                                                            const stored = sessionStorage.getItem(key);
                                                            let parsed = stored ? JSON.parse(stored) : {};
                                                            parsed = Object.assign(parsed || {}, {
                                                                email: displayEmail,
                                                                temporary_password: json.temporary_password,
                                                                name: displayName,
                                                            });
                                                            sessionStorage.setItem(key, JSON.stringify(parsed));

                                                            // Clear any previous "sent" flag because this is a new temporary password
                                                            const sentKey = `user_credentials_sent_${displayEmail}`;
                                                            sessionStorage.removeItem(sentKey);
                                                            setSent(false);
                                                        } catch {
                                                            // ignore
                                                        }
                                                        setToast({ message: (json && json.message) || '再作成しました', type: 'success' });
                                                    } else {
                                                        setToast({ message: (json && json.error) || '再作成に失敗しました', type: 'error' });
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    setToast({ message: '再作成に失敗しました', type: 'error' });
                                                } finally {
                                                    setRegenerating(false);
                                                }
                                            }}
                                        >
                                            再作成
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            disabled={sending || sent || regenerating}
                                            aria-busy={sending}
                                            onClick={async () => {
                                                if (sending || sent || regenerating) return;
                                                setSending(true);
                                                try {
                                                    const metaToken =
                                                        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                                    const xsrfCookie = (document.cookie || '').split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
                                                    const xsrfValue = xsrfCookie ? decodeURIComponent(xsrfCookie.split('=')[1]) : '';

                                                    const res = await fetch(route('users.credentials.send', user.id), {
                                                        method: 'POST',
                                                        // include cookies so Laravel session / CSRF token are available
                                                        credentials: 'include',
                                                        headers: {
                                                            Accept: 'application/json',
                                                            'X-Requested-With': 'XMLHttpRequest',
                                                            'Content-Type': 'application/json',
                                                            'X-CSRF-TOKEN': metaToken,
                                                            'X-XSRF-TOKEN': xsrfValue,
                                                        },
                                                    });
                                                    let json = null;
                                                    try {
                                                        json = await res.json();
                                                    } catch {
                                                        // non-json response (e.g., HTML redirect)
                                                    }
                                                    if (res.ok) {
                                                        setToast({ message: (json && json.message) || '送信しました', type: 'success' });
                                                        setSent(true);
                                                        try {
                                                            const sentKey = `user_credentials_sent_${displayEmail}`;
                                                            sessionStorage.setItem(sentKey, '1');
                                                        } catch {
                                                            // ignore
                                                        }
                                                    } else {
                                                        setToast({
                                                            message: (json && json.error) || `送信に失敗しました (HTTP ${res.status})`,
                                                            type: 'error',
                                                        });
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    setToast({ message: '送信に失敗しました', type: 'error' });
                                                } finally {
                                                    setSending(false);
                                                }
                                            }}
                                        >
                                            {sending ? (
                                                <>
                                                    <svg
                                                        className="mr-2 -ml-1 h-5 w-5 animate-spin text-white"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        ></circle>
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                        ></path>
                                                    </svg>
                                                    送信中
                                                </>
                                            ) : sent ? (
                                                '送信済み'
                                            ) : (
                                                '送信'
                                            )}
                                        </Button>

                                        <Button
                                            onClick={() => {
                                                const rawLogin = route('login');
                                                const loginUrl =
                                                    typeof rawLogin === 'string' && rawLogin.match(/^https?:\/\//)
                                                        ? rawLogin
                                                        : typeof window !== 'undefined'
                                                          ? window.location.origin + rawLogin
                                                          : rawLogin;

                                                copyText(
                                                    `名前：${displayName}\nログインID：${displayEmail}\n仮パスワード：${displayTemp ?? '（表示できません）'}\nログインページ：${loginUrl}\n`,
                                                );
                                            }}
                                        >
                                            コピー
                                        </Button>
                                        {copied && <div className="ml-3 text-sm text-green-600">コピーしました</div>}
                                    </div>
                                </CardFooter>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </AppSidebarLayout>
    );
}
