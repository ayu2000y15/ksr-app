import AdminSettingsMenu from '@/components/admin-settings-menu';

export default function AdminSettingsPage() {
    return (
        <div className="p-8">
            <h1 className="mb-4 text-2xl font-bold">ロール・権限管理</h1>
            <AdminSettingsMenu />
        </div>
    );
}
