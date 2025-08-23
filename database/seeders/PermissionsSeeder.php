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

            // shift applications (休暇申請)
            'shift_application.view',
            'shift_application.create',
            'shift_application.update',
            'shift_application.delete',

            // default shifts (管理者向け: デフォルトシフト設定)
            'default_shift.view',
            'default_shift.create',
            'default_shift.update',
            'default_shift.delete',

            // per-user shift settings (ユーザー別休暇上限設定)
            'user_shift_setting.view',
            'user_shift_setting.create',
            'user_shift_setting.update',
            'user_shift_setting.delete',
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
