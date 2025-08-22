<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class TestUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 一般ユーザーロールを持つテストユーザーを作成
        $generalUser = User::firstOrCreate(
            ['email' => 'test@ksr.com'],
            [
                'name' => 'テストユーザー',
                'password' => bcrypt('password'),
                'email_verified_at' => now(),
                'status' => 'active',
            ]
        );

        $generalUser->assignRole('一般ユーザー');

        // 管理者ロールを持つテストユーザーを作成
        $managerUser = User::firstOrCreate(
            ['email' => 'manager@ksr.com'],
            [
                'name' => '管理者ユーザー',
                'password' => bcrypt('password'),
                'email_verified_at' => now(),
                'status' => 'active',
            ]
        );

        $managerUser->assignRole('管理者');

        echo "テストユーザーが作成されました\n";
        echo "一般ユーザー: test@ksr.com / password\n";
        echo "管理者ユーザー: manager@ksr.com / password\n";
    }
}
