import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Toast from '@/components/ui/toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function CredentialsPage() {
    const pageProps: any = usePage().props;
    const flash = pageProps.flash || null;
    const credentials = pageProps.credentials || (flash && flash.credentials) || null;
    const user = pageProps.user || null;

    const [copiedAll, setCopiedAll] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(
        flash && flash.success ? { message: flash.success, type: 'success' } : flash && flash.error ? { message: flash.error, type: 'error' } : null,
    );

    useEffect(() => {
        if (credentials && typeof window !== 'undefined') {
            try {
                const credKey = `user_credentials_${credentials.email}`;
                const sentKey = `user_credentials_sent_${credentials.email}`;

                // Check if we have stored credentials for this email. If the temporary password differs,
                // this is a new credentials generation — clear any previous "sent" flag.
                const prev = sessionStorage.getItem(credKey);
                if (prev) {
                    try {
                        const parsed = JSON.parse(prev);
                        if (parsed && parsed.temporary_password === credentials.temporary_password) {
                            // same credentials as before
                            if (sessionStorage.getItem(sentKey) === '1') setSent(true);
                        } else {
                            // new temporary password -> clear sent flag and overwrite stored credentials
                            sessionStorage.removeItem(sentKey);
                            sessionStorage.setItem(credKey, JSON.stringify(credentials));
                            setSent(false);
                        }
                    } catch {
                        // parsing error - overwrite and clear sent
                        sessionStorage.removeItem(sentKey);
                        sessionStorage.setItem(credKey, JSON.stringify(credentials));
                        setSent(false);
                    }
                } else {
                    // first time storing these credentials
                    sessionStorage.setItem(credKey, JSON.stringify(credentials));
                    setSent(false);
                }
            } catch {
                // ignore
            }
        }
    }, [credentials]);

    const copyText = async (text: string, flagSetter: (v: boolean) => void) => {
        try {
            await navigator.clipboard.writeText(text);
            flagSetter(true);
            setTimeout(() => flagSetter(false), 2000);
        } catch {
            console.error('コピーに失敗しました');
        }
    };

    const breadcrumbs = [
        { title: 'ユーザー管理', href: route('users.index') },
        { title: 'ログイン情報', href: '' },
    ];

    if (!credentials) {
        return (
            <AppSidebarLayout breadcrumbs={breadcrumbs}>
                <Head title="ログイン情報" />
                <div className="py-12">
                    <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>ログイン情報</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p>表示するログイン情報がありません。ユーザー作成後に表示されます。</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </AppSidebarLayout>
        );
    }

    const rawLogin = route('login');
    const loginUrl = typeof rawLogin === 'string' && rawLogin.match(/^https?:\/\//) ? rawLogin : window.location.origin + rawLogin;

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="ログイン情報" />

            <div className="py-12">
                <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    <Card>
                        <CardHeader>
                            <CardTitle>登録完了 - ログイン情報</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-2">以下の情報でログインできます。初回ログイン時にパスワードの変更が必要です。</p>
                            <div className="space-y-2">
                                <div>
                                    <Label>名前</Label>
                                    <div className="rounded-md bg-gray-100 p-2">{credentials.name}</div>
                                </div>

                                <div>
                                    <Label>メールアドレス (ID)</Label>
                                    <div className="rounded-md bg-gray-100 p-2">{credentials.email}</div>
                                </div>

                                <div>
                                    <Label>仮パスワード</Label>
                                    <div className="rounded-md bg-gray-100 p-2 font-mono">{credentials.temporary_password}</div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-4">
                            <Button
                                variant="outline"
                                disabled={sending || sent}
                                aria-busy={sending}
                                onClick={async () => {
                                    if (sending || sent) return;
                                    setSending(true);
                                    try {
                                        // include both meta CSRF token and XSRF-TOKEN cookie value
                                        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                        const xsrfCookie = (document.cookie || '').split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
                                        const xsrfValue = xsrfCookie ? decodeURIComponent(xsrfCookie.split('=')[1]) : '';

                                        let res;
                                        if (user) {
                                            res = await fetch(route('users.credentials.send', user.id), {
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
                                        } else {
                                            // fallback: post email-only to email endpoint
                                            res = await fetch(route('users.credentials.send.by_email'), {
                                                method: 'POST',
                                                credentials: 'include',
                                                headers: {
                                                    Accept: 'application/json',
                                                    'X-Requested-With': 'XMLHttpRequest',
                                                    'Content-Type': 'application/json',
                                                    'X-CSRF-TOKEN': metaToken,
                                                    'X-XSRF-TOKEN': xsrfValue,
                                                },
                                                body: JSON.stringify({ email: credentials.email }),
                                            });
                                        }

                                        let json = null;
                                        try {
                                            json = await res.json();
                                        } catch {
                                            // non-json response (e.g., HTML redirect); fall back to status
                                        }
                                        if (res.ok) {
                                            setToast({ message: (json && json.message) || '送信しました', type: 'success' });
                                            setSent(true);
                                            try {
                                                const sentKey = `user_credentials_sent_${credentials.email}`;
                                                sessionStorage.setItem(sentKey, '1');
                                            } catch {
                                                // ignore
                                            }
                                        } else {
                                            setToast({ message: (json && json.error) || `送信に失敗しました (HTTP ${res.status})`, type: 'error' });
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
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
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
                                onClick={() =>
                                    copyText(
                                        `名前：${credentials.name}\nログインID：${credentials.email}\n仮パスワード：${credentials.temporary_password}\nログインページ：${loginUrl}\n`,
                                        setCopiedAll,
                                    )
                                }
                            >
                                コピー
                            </Button>
                            {copiedAll && <div className="ml-3 text-sm text-green-600">コピーしました</div>}
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </AppSidebarLayout>
    );
}
