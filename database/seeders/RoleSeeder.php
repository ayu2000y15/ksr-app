<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // システム管理者ロールを作成
        $adminRole = Role::firstOrCreate(['name' => 'システム管理者']);

        // 全ての権限をシステム管理者ロールに付与
        $allPermissions = Permission::pluck('id')->all();
        $adminRole->syncPermissions($allPermissions);

        // 最初のユーザー（管理者）にロールを割り当て
        $user = User::first();
        if ($user) {
            //より分かりやすいメソッドに変更
            $user->assignRole($adminRole);
        }
    }
}
