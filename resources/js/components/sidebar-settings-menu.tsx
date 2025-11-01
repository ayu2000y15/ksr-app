import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Link, usePage } from '@inertiajs/react';
import { Calendar, Clock, Key, Shield, Sliders, Users } from 'lucide-react';
import * as React from 'react';

// 各種設定メニューに表示可能な項目があるかチェックするカスタムフック
export function useHasVisibleSettingsItems() {
    const page = usePage<import('@/types').SharedData>();
    const permissions: string[] = page.props?.auth?.permissions ?? [];
    const isSuperAdmin: boolean = page.props?.auth?.isSuperAdmin ?? (page.props as any)['auth.isSuperAdmin'] ?? false;

    // システム管理者なら常にtrue
    if (isSuperAdmin) return true;

    const settings = [
        { permission: 'role.view' },
        { permission: 'permission.view' },
        { permission: 'role.assign' },
        { permission: 'default_shift.view' },
        { permission: 'user_shift_setting.view' },
        { permission: 'holiday.view' },
        { permission: 'activitylog.view' },
    ];

    // いずれかの権限があればtrue
    return settings.some((item) => item.permission && permissions.includes(item.permission));
}

export function SidebarSettingsMenu({ isCollapsed, currentPath }: { isCollapsed: boolean; currentPath: string }) {
    const page = usePage<import('@/types').SharedData>();
    const permissions: string[] = page.props?.auth?.permissions ?? [];
    const isSuperAdmin: boolean = page.props?.auth?.isSuperAdmin ?? (page.props as any)['auth.isSuperAdmin'] ?? false;

    const settings = [
        { title: 'ロール管理', href: '/admin/roles', icon: Shield, permission: 'role.view' },
        { title: '権限設定', href: '/admin/role-permissions', icon: Key, permission: 'permission.view' },
        { title: 'ユーザーロール割当', href: '/admin/user-roles', icon: Users, permission: 'role.assign' },
        { title: 'デフォルトシフト設定', href: '/admin/default-shifts', icon: Clock, permission: 'default_shift.view' },
        { title: 'ユーザー別休暇上限設定', href: '/admin/user-shift-settings', icon: Sliders, permission: 'user_shift_setting.view' },
        { title: '休日登録', href: '/admin/holidays', icon: Calendar, permission: 'holiday.view' },
        { title: '活動ログ', href: '/admin/activity-logs', icon: Calendar, permission: 'activitylog.view' },
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
