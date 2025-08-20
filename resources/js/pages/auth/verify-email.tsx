import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';

import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';

export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <AuthLayout title="メール認証" description="ご登録いただいたメールアドレスに送信されたリンクをクリックして、認証を完了してください。">
            <Head title="メール認証" />

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">新しい認証リンクを送信しました。</div>
            )}

            <Form method="post" action={route('verification.send')} className="space-y-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                            認証メールを再送信
                        </Button>

                        <TextLink href={route('logout')} method="post" className="mx-auto block text-sm">
                            ログアウト
                        </TextLink>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
