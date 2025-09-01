<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 最初に権限を作成
        $this->call(PermissionsSeeder::class);

        // 👈 次に管理者ユーザーを作成
        User::create([
            'id'    => 0,
            'name' => '管理者',
            'email' => 'ayuka.n@cosplatform.co.jp',
            'password' => bcrypt('password'),
        ]);

        // 👈 最後に、作成したユーザーに管理者ロールを割り当て
        $this->call(RoleSeeder::class);
        // seed sample holidays
        $this->call(HolidaySeeder::class);
    }
}
