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
import { AlertTriangle, Calendar, CalendarCheck, CheckSquare, CreditCard, FileText, Home, MessageSquare, Package, Users, Wrench } from 'lucide-react';
import * as React from 'react';
import { AppLogo } from './app-logo';
import { SidebarSettingsMenu, useHasVisibleSettingsItems } from './sidebar-settings-menu';

// メインのナビゲーション項目を定義
const mainNavItems: NavItem[] = [
    { title: 'ユーザー管理', href: '/users', icon: Users, permission: 'user.view' },
    { title: '各種申請', href: '/shift-applications', icon: CalendarCheck, permission: 'shift_application.view' },
    { title: '日次ノート', href: '/daily-notes', icon: FileText, permission: 'daily_note.view' },
    { title: 'タスク・予定', href: '/tasks', icon: CheckSquare, permission: 'task.view' },
    { title: '掲示板・マニュアル', href: '/posts', icon: MessageSquare, permission: '' },
    { title: 'シフト管理', href: '/shifts', icon: Calendar, permission: 'shift.view' },
    { title: '在庫管理', href: '/inventory', icon: Package },
    { title: '破損在庫管理', href: '/inventory/damaged', icon: AlertTriangle, permission: 'damaged_inventory.view' },
    { title: '物件管理', href: '/properties', icon: Home, permission: 'properties.view' },
    { title: '経理向け', href: '/accounting', icon: CreditCard, permission: 'accounting.view' },
];

export function AppSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const page = usePage<SharedData>();
    const permissions: string[] = page.props?.auth?.permissions ?? [];
    // support both nested auth.isSuperAdmin and top-level 'auth.isSuperAdmin' share
    const isSuperAdmin: boolean = page.props?.auth?.isSuperAdmin ?? (page.props as any)['auth.isSuperAdmin'] ?? false;
    // nested permissions from SharePermissions middleware (Inertia shared props)
    const nestedPermissions = (page.props as unknown as { permissions?: Record<string, any> } | undefined)?.permissions;
    const inventoryPerms = nestedPermissions?.inventory ?? { view: false, create: false, update: false, delete: false, logs: false };

    // 各種設定の展開状態
    const [showSettings, setShowSettings] = React.useState(false);

    // 各種設定メニューに表示可能な項目があるかチェック
    const hasVisibleSettings = useHasVisibleSettingsItems();

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
                        if (!isSuperAdmin && item.permission) {
                            // flat permissions from auth.permissions
                            const hasFlat = permissions.includes(item.permission);
                            // nested permissions may be like { properties: { view: true } }
                            const parts = item.permission.split('.');
                            let hasNested = false;
                            if (parts.length === 2 && nestedPermissions && nestedPermissions[parts[0]]) {
                                const key = parts[1];
                                hasNested = Boolean(nestedPermissions[parts[0]][key]);
                            }
                            if (!hasFlat && !hasNested) return null;
                        }
                        // 在庫管理は Inventory ポリシー(viewAny) に基づいて表示
                        if (item.title === '在庫管理') {
                            if (!isSuperAdmin && !inventoryPerms.view) return null;
                        }
                        // special-case: when on damage-conditions pages, highlight "破損在庫管理"
                        const isDamageConditionsPath =
                            currentPath.startsWith('/inventory/damage-conditions') || currentPath.startsWith('/inventory/damaged');
                        const isActiveCandidate =
                            (item.href === '/inventory/damaged' && isDamageConditionsPath) ||
                            currentPath === item.href ||
                            (item.href !== '/' && currentPath.startsWith(item.href));
                        // If there's a deeper nav item that also matches the current path,
                        // prefer the deeper item and don't mark this parent as active.
                        const hasDeeperMatch =
                            mainNavItems.some(
                                (other) => other.href !== item.href && other.href.startsWith(item.href) && currentPath.startsWith(other.href),
                            ) ||
                            // If on damage-conditions pages, consider the inventory parent as having a deeper match
                            (isDamageConditionsPath && item.href === '/inventory');
                        const isActive = isActiveCandidate && !hasDeeperMatch;
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
                    {/* 各種設定 - 表示可能な項目がある場合のみ表示 */}
                    {hasVisibleSettings && (
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
                    )}
                </SidebarMenu>
                {/* 各種設定のサブメニュー */}
                {showSettings && hasVisibleSettings && <SidebarSettingsMenu isCollapsed={isCollapsed} currentPath={currentPath} />}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
