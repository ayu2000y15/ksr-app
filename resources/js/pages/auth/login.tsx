import axios from '@/axios';
import { Head, router, usePage } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

interface LoginProps {
    status?: string;
    canResetPassword?: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const pageProps: any = usePage().props;
    const flash = pageProps.flash || null;

    // フォームの状態をuseStateで管理
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [processing, setProcessing] = useState(false);
    // エラーメッセージ用の状態
    const [errors, setErrors] = useState<{ email?: string[]; password?: string[]; root?: string }>({});

    // フォーム送信処理
    const submit: FormEventHandler = async (e) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            // 1. 最初に必ずCSRFクッキーを取得
            await axios.get('/sanctum/csrf-cookie');

            // 2. 次にログイン情報をPOST
            await axios.post(route('login'), { email, password, remember });

            // 3. ログイン成功後、ダッシュボードに移動
            router.visit(route('dashboard'));
        } catch (error: any) {
            if (error.response?.status === 422) {
                // バリデーションエラーの処理
                setErrors(error.response.data.errors);
            } else {
                // その他の認証エラーなど
                setErrors({ root: ['メールアドレスまたはパスワードが正しくありません。'] });
                console.error('An unexpected error occurred:', error);
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AuthLayout title="ログイン" description="メールアドレスとパスワードを入力してください">
            <Head title="ログイン" />

            {/* Inertiaの<Form>から通常の<form>に変更 */}
            <form onSubmit={submit} className="flex flex-col gap-6">
                <div className="grid gap-6">
                    {/* 一般的なエラーメッセージの表示エリア */}
                    <InputError message={errors.root?.[0]} />

                    <div className="grid gap-2">
                        <Label htmlFor="email">メールアドレス</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="email"
                            placeholder="email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <InputError message={errors.email?.[0]} />
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="password">パスワード</Label>
                            {canResetPassword && (
                                <TextLink href={route('password.request')} className="ml-auto text-sm" tabIndex={5}>
                                    パスワードを忘れた場合はこちら
                                </TextLink>
                            )}
                        </div>
                        <Input
                            id="password"
                            type="password"
                            name="password"
                            required
                            tabIndex={2}
                            autoComplete="current-password"
                            placeholder="パスワード"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <InputError message={errors.password?.[0]} />
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="remember"
                            name="remember"
                            tabIndex={3}
                            checked={remember}
                            onCheckedChange={(checked) => setRemember(Boolean(checked))}
                        />
                        <Label htmlFor="remember">ログイン状態を維持する</Label>
                    </div>

                    <Button type="submit" className="mt-4 w-full" tabIndex={4} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        ログイン
                    </Button>
                </div>
            </form>

            {status && <div className="mb-4 text-center text-sm font-medium text-green-600">{status}</div>}
            {flash && flash.error && <div className="mb-4 text-center text-sm font-medium text-red-600">{flash.error}</div>}
        </AuthLayout>
    );
}
