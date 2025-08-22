import { Link, usePage } from '@inertiajs/react';

export default function AdminSettingsMenu() {
    const page = usePage();
    const authProps = page.props?.auth as unknown as { permissions?: string[] } | undefined;
    const authPermissions: string[] = authProps?.permissions ?? [];
    const can = (perm: string) => authPermissions.includes(perm);

    return (
        <div className="space-y-2 p-4">
            <h4 className="mb-2 font-bold">ロール・権限管理</h4>
            <ul className="space-y-1">
                {can('role.view') && (
                    <li>
                        <Link href="/admin/roles" className="text-blue-700 hover:underline">
                            ロール一覧・作成
                        </Link>
                    </li>
                )}
                {can('permission.view') && (
                    <li>
                        <Link href="/admin/role-permissions" className="text-blue-700 hover:underline">
                            権限設定
                        </Link>
                    </li>
                )}
                {can('user.update') && (
                    <li>
                        <Link href="/admin/user-roles" className="text-blue-700 hover:underline">
                            ユーザーへのロール割り当て
                        </Link>
                    </li>
                )}
            </ul>
        </div>
    );
}
