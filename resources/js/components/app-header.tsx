import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type BreadcrumbItem, type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { ClipboardList, Home, LayoutDashboard, Package, Users, Wrench } from 'lucide-react';
import { AppLogo } from './app-logo';

// メインのナビゲーション項目を定義
// route() helper may not be available in some build steps; compute hrefs defensively.
const safeRoute = (name: string, fallback = '#') => {
    try {
        // @ts-ignore
        if (typeof route === 'function') return route(name);
    } catch (e) {
        // ignore
    }
    return fallback;
};

const mainNavItems: NavItem[] = [
    { title: 'ダッシュボード', href: safeRoute('dashboard', '/dashboard'), icon: LayoutDashboard },
    { title: 'ユーザー管理', href: safeRoute('users.index', '/users'), icon: Users },
    { title: 'シフト管理', href: safeRoute('shifts.index', '/shifts'), icon: ClipboardList },
    { title: '在庫管理', href: safeRoute('inventory.index', '/inventory'), icon: Package },
    { title: '物件管理', href: safeRoute('properties.index', '/properties'), icon: Home },
    { title: '各種設定', href: '#', icon: Wrench }, // TODO
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={route('dashboard')} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarMenu>
                    {mainNavItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <Link
                                href={item.href}
                                className={`flex w-full items-center gap-2 rounded-md p-2 text-sm font-medium transition-colors duration-100 ease-in-out hover:bg-secondary ${
                                    route().current(item.href.substring(1) + '*') ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''
                                }`}
                            >
                                <item.icon className="h-4 w-4" />
                                <span className="min-w-0 flex-1">{item.title}</span>
                            </Link>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

// Minimal AppHeader wrapper to satisfy imports in layouts
export function AppHeader({ breadcrumbs }: { breadcrumbs?: BreadcrumbItem[] | undefined }) {
    return (
        <header className="w-full">
            <AppSidebar />
        </header>
    );
}

export default AppSidebar;
