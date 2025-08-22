import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Link, usePage } from '@inertiajs/react';
import { Key, Shield, Users } from 'lucide-react';
import * as React from 'react';

export function SidebarSettingsMenu({ isCollapsed, currentPath }: { isCollapsed: boolean; currentPath: string }) {
    const page = usePage<import('@/types').SharedData>();
    const permissions: string[] = page.props?.auth?.permissions ?? [];
    const isSuperAdmin: boolean = page.props?.auth?.isSuperAdmin ?? (page.props as any)['auth.isSuperAdmin'] ?? false;
    React.useEffect(() => {
        const authProps = page.props?.auth as unknown as { permissions?: string[] } | undefined;
        const nestedPermissions = (page.props as unknown as { permissions?: Record<string, unknown> } | undefined)?.permissions;
        console.log('[SidebarSettingsMenu] page.props.auth.permissions', authProps?.permissions);
        console.log('[SidebarSettingsMenu] page.props.permissions', nestedPermissions);
        console.log('[SidebarSettingsMenu] isSuperAdmin', isSuperAdmin);
    }, [page.props, isSuperAdmin]);

    const settings = [
        { title: 'ロール管理', href: '/admin/roles', icon: Shield, permission: 'role.view' },
        { title: '権限設定', href: '/admin/role-permissions', icon: Key, permission: 'permission.view' },
        { title: 'ユーザーロール割当', href: '/admin/user-roles', icon: Users, permission: 'role.assign' },
        // 今後ここに追加
    ];
    return (
        <SidebarMenu>
            {settings.map((item) => {
                // システム管理者は全て表示
                if (!isSuperAdmin && item.permission && !permissions.includes(item.permission)) {
                    return null;
                }
                const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));
                return (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild tooltip={isCollapsed ? item.title : undefined} isActive={isActive}>
                            <Link href={item.href} className="flex items-center gap-2">
                                {item.icon
                                    ? (() => {
                                          const Icon = item.icon as React.ComponentType<any>;
                                          return <Icon className="h-4 w-4" />;
                                      })()
                                    : null}
                                {!isCollapsed && <span className="min-w-0 flex-1">{item.title}</span>}
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    );
}
