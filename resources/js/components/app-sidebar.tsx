import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import type { NavItem, SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ClipboardList, Home, Package, Users, Wrench } from 'lucide-react';
import * as React from 'react';
import { AppLogo } from './app-logo';
import { SidebarSettingsMenu } from './sidebar-settings-menu';

// メインのナビゲーション項目を定義
const mainNavItems: NavItem[] = [
    { title: 'ユーザー管理', href: '/users', icon: Users, permission: 'user.view' },
    { title: 'シフト管理', href: '#', icon: ClipboardList }, // TODO
    { title: '在庫管理', href: '#', icon: Package }, // TODO
    { title: '物件管理', href: '#', icon: Home }, // TODO
];

export function AppSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const page = usePage<SharedData>();
    const permissions: string[] = page.props?.auth?.permissions ?? [];
    // support both nested auth.isSuperAdmin and top-level 'auth.isSuperAdmin' share
    const isSuperAdmin: boolean = page.props?.auth?.isSuperAdmin ?? (page.props as any)['auth.isSuperAdmin'] ?? false;
    React.useEffect(() => {
        // debug: log permissions received from server
        // auth.permissions is a flat array; page.props.permissions may be nested
        const authProps = page.props?.auth as unknown as { permissions?: string[] } | undefined;
        const nestedPermissions = (page.props as unknown as { permissions?: Record<string, unknown> } | undefined)?.permissions;
        console.log('[AppSidebar] page.props.auth.permissions', authProps?.permissions);
        console.log('[AppSidebar] page.props.permissions', nestedPermissions);
        console.log('[AppSidebar] isSuperAdmin', isSuperAdmin);
    }, [page.props, isSuperAdmin]);

    // 各種設定の展開状態
    const [showSettings, setShowSettings] = React.useState(false);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild tooltip={isCollapsed ? 'ダッシュボード' : undefined}>
                            <Link href="/dashboard">
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarMenu>
                    {mainNavItems.map((item) => {
                        // システム管理者は全て表示
                        if (!isSuperAdmin && item.permission && !permissions.includes(item.permission)) {
                            return null;
                        }
                        const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));
                        if (item.title === '各種設定') return null;
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
                    {/* 各種設定 */}
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            tooltip={isCollapsed ? '各種設定' : undefined}
                            isActive={
                                showSettings ||
                                ['/admin/roles', '/admin/role-permissions', '/admin/user-roles'].some((p) => currentPath.startsWith(p))
                            }
                            onClick={() => setShowSettings((v) => !v)}
                        >
                            <div className="flex cursor-pointer items-center gap-2">
                                <Wrench className="h-4 w-4" />
                                {!isCollapsed && <span className="min-w-0 flex-1">各種設定</span>}
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                {/* 各種設定のサブメニュー */}
                {showSettings && <SidebarSettingsMenu isCollapsed={isCollapsed} currentPath={currentPath} />}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
