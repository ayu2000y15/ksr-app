<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class CheckUserPermissionSeeder extends Seeder
{
    public function run(): void
    {
        echo "=== ユーザー権限確認 ===\n";
        
        $users = User::with('roles.permissions')->get();
        
        foreach ($users as $user) {
            echo "\nユーザー: {$user->name} ({$user->email})\n";
            echo "ロール: " . $user->roles->pluck('name')->implode(', ') . "\n";
            echo "権限: " . $user->getAllPermissions()->pluck('name')->implode(', ') . "\n";
        }
    }
}
