<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run()
    {
        // システム管理者ユーザーを作成（存在しない場合）
        $admin = User::firstOrCreate(
            ['email' => 'admin@ksr.com'],
            [
                'name' => 'システム管理者',
                'password' => Hash::make('password'),
                'status' => 'active',
                'must_change_password' => false,
            ]
        );

        // システム管理者ロールを取得
        $adminRole = Role::where('name', 'システム管理者')->first();

        if ($adminRole) {
            // ユーザーにシステム管理者ロールを割り当て
            $admin->assignRole($adminRole);
            $this->command->info('システム管理者ユーザーにロールが割り当てられました。');
        } else {
            $this->command->error('システム管理者ロールが見つかりません。');
        }

        $this->command->info('管理者ユーザー: ' . $admin->email);
        $this->command->info('パスワード: password');
    }
}
