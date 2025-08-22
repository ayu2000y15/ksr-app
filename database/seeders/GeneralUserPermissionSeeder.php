<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class GeneralUserPermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 一般ユーザーロールに基本権限を付与
        $generalRole = \Spatie\Permission\Models\Role::where('name', '一般ユーザー')->first();
        
        if ($generalRole) {
            // ユーザー関連の表示権限のみ付与
            $permissions = [
                'user.view',
            ];

            foreach ($permissions as $permissionName) {
                $permission = Permission::where('name', $permissionName)->first();
                if ($permission) {
                    $generalRole->givePermissionTo($permission);
                }
            }
        }

        // 管理者ロールに管理権限を付与
        $managerRole = \Spatie\Permission\Models\Role::where('name', '管理者')->first();
        
        if ($managerRole) {
            // ユーザー管理権限とロール表示権限を付与
            $permissions = [
                'user.view',
                'user.create',
                'user.update',
                'role.view',
            ];

            foreach ($permissions as $permissionName) {
                $permission = Permission::where('name', $permissionName)->first();
                if ($permission) {
                    $managerRole->givePermissionTo($permission);
                }
            }
        }

        echo "ロール別権限を設定しました\n";
        echo "一般ユーザー: ユーザー表示権限のみ\n";
        echo "管理者: ユーザー管理権限とロール表示権限\n";
        echo "システム管理者: 全権限\n";
    }
}
