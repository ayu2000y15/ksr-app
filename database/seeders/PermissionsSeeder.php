<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // 権限リスト
        $permissions = [
            // user management
            'user.view',
            'user.create',
            'user.update',
            'user.delete',

            // role & permission management
            'role.viewAny',
            'role.view',
            'role.create',
            'role.update',
            'role.delete',
            'role.assign',
            'permission.view',
            'permission.create',
            'permission.update',
            'permission.delete',

            // shift management
            'shift.view',
            'shift.create',
            'shift.update',
            'shift.delete',
            // task management
            'task.view',
            'task.create',
            'task.update',
            'task.delete',
            // additional variants for finer-grained checks
            'shift.viewAny',
            'shift.manage',

            // explicit shift detail permissions (used in some checks / future extension)
            'shift_detail.view',
            'shift_detail.create',
            'shift_detail.update',
            'shift_detail.delete',

            // shift applications (休暇申請)
            'shift_application.view',
            'shift_application.create',
            'shift_application.update',
            'shift_application.delete',

            // inventory management
            'inventory.view',
            'inventory.create',
            'inventory.update',
            'inventory.delete',
            'inventory.log.view',
            // damaged inventory (破損在庫)
            'damaged_inventory.view',
            'damaged_inventory.create',
            'damaged_inventory.update',
            'damaged_inventory.delete',

            // default shifts (管理者向け: デフォルトシフト設定)
            'default_shift.view',
            'default_shift.create',
            'default_shift.update',
            'default_shift.delete',

            // holiday management (休日登録)
            'holiday.view',
            'holiday.create',
            'holiday.update',
            'holiday.delete',

            // daily notes (日次ノート)
            'daily_note.view',
            'daily_note.create',

            // announcements (お知らせ)
            'announcement.create',

            // per-user shift settings (ユーザー別休暇上限設定)
            'user_shift_setting.view',
            'user_shift_setting.create',
            'user_shift_setting.update',
            'user_shift_setting.delete',

            // properties (物件マスタ管理)
            'properties.view',
            'properties.create',
            'properties.edit',
            'properties.delete',
            'properties.reorder',
        ];

        // 既存の権限はそのままに、新しい権限のみを作成
        $defaultGuard = config('auth.defaults.guard', 'web');
        foreach ($permissions as $name) {
            Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => $defaultGuard,
            ]);
        }
    }
}
