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
            'user.view',
            'user.create',
            'user.update',
            'user.delete',
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
        ];

        // 既存の権限はそのままに、新しい権限のみを作成
        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name]);
        }
    }
}
