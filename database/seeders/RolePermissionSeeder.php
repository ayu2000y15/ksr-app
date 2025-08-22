<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    public function run()
    {
        // テーブルが存在するかチェック
        $tables = DB::select('SHOW TABLES');
        $this->command->info('Available tables:');
        foreach ($tables as $table) {
            $tableName = array_values((array)$table)[0];
            $this->command->info('- ' . $tableName);
        }

        // テーブル名の設定確認
        $this->command->info('Configured table names:');
        $this->command->info('Roles table: ' . config('permission.table_names.roles'));
        $this->command->info('Permissions table: ' . config('permission.table_names.permissions'));

        // システム管理者のロールを作成（存在しない場合）
        $adminRole = Role::firstOrCreate(['name' => 'システム管理者']);
        
        // その他の基本ロールを作成
        $managerRole = Role::firstOrCreate(['name' => '管理者']);
        $memberRole = Role::firstOrCreate(['name' => '一般ユーザー']);
        
        // 基本的な権限を作成
        $permissions = [
            // ユーザー管理
            'user.view',
            'user.create', 
            'user.update',
            'user.delete',
            
            // ロール管理
            'role.view',
            'role.create',
            'role.update', 
            'role.delete',
            
            // シフト管理
            'shift.view',
            'shift.create',
            'shift.update',
            'shift.delete',
            'shift.approve',
            
            // 投稿管理
            'post.view',
            'post.create',
            'post.update',
            'post.delete',
            
            // 在庫管理
            'inventory.view',
            'inventory.create',
            'inventory.update',
            'inventory.delete',
            
            // 物件管理
            'property.view',
            'property.create',
            'property.update',
            'property.delete',
            
            // タスク管理
            'task.view',
            'task.create',
            'task.update',
            'task.delete',
            'task.assign',
            
            // レポート管理
            'report.view',
            'report.create',
            'report.update',
            'report.delete',
            
            // 設定管理
            'settings.view',
            'settings.update',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // システム管理者には全権限を付与
        $adminRole->syncPermissions(Permission::all());
        
        // 管理者には基本的な権限を付与（システム設定以外）
        $managerPermissions = Permission::whereNotIn('name', [
            'user.delete',
            'role.create',
            'role.update', 
            'role.delete',
            'settings.update'
        ])->get();
        $managerRole->syncPermissions($managerPermissions);
        
        // 一般ユーザーには閲覧権限のみ
        $memberPermissions = Permission::where('name', 'like', '%.view')->get();
        $memberRole->syncPermissions($memberPermissions);

        $this->command->info('ロールと権限が正常にセットアップされました。');
    }
}
