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
import type { NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { ClipboardList, Home, Package, Users, Wrench } from 'lucide-react';
import { AppLogo } from './app-logo';

// メインのナビゲーション項目を定義
const mainNavItems: NavItem[] = [
    // { title: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
    { title: 'ユーザー管理', href: '/users', icon: Users },
    { title: 'シフト管理', href: '#', icon: ClipboardList }, // TODO
    { title: '在庫管理', href: '#', icon: Package }, // TODO
    { title: '物件管理', href: '#', icon: Home }, // TODO
    { title: '各種設定', href: '#', icon: Wrench }, // TODO
];

export function AppSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

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
                        const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild tooltip={isCollapsed ? item.title : undefined} isActive={isActive}>
                                    <Link href={item.href} className="flex items-center gap-2">
                                        <item.icon className="h-4 w-4" />
                                        {!isCollapsed && <span className="min-w-0 flex-1">{item.title}</span>}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
