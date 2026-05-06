<?php

namespace App\Console\Commands;

use App\Models\Season;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreateAdminUser extends Command
{
    protected $signature = 'admin:create
                            {--name= : 管理者名}
                            {--email= : メールアドレス}
                            {--password= : パスワード（省略時は自動生成）}';

    protected $description = 'システム管理者アカウントを作成します';

    public function handle(): int
    {
        $name     = $this->option('name')     ?? $this->ask('管理者名を入力してください');
        $email    = $this->option('email')    ?? $this->ask('メールアドレスを入力してください');
        $password = $this->option('password') ?? $this->secret('パスワードを入力してください（Enter で自動生成）') ?: $this->generatePassword();

        // メールアドレス重複チェック（シーズンをまたいで全件）
        if (User::where('email', $email)->exists()) {
            $this->error("メールアドレス {$email} は既に登録されています。");
            return 1;
        }

        $activeSeason = Season::where('is_active', true)->first();

        $user = User::create([
            'season_id' => $activeSeason?->id,
            'name'      => $name,
            'email'     => strtolower(trim($email)),
            'password'  => Hash::make($password),
            'status'    => 'active',
        ]);

        // システム管理者ロールを付与
        $user->assignRole('システム管理者');

        $this->info('✅ 管理者アカウントを作成しました。');
        $this->table(
            ['項目', '値'],
            [
                ['名前',           $user->name],
                ['メールアドレス', $user->email],
                ['パスワード',     $password],
                ['シーズン',       $activeSeason?->name ?? 'なし'],
                ['ロール',         'システム管理者'],
            ]
        );
        $this->warn('⚠ パスワードは安全な場所に保管し、ログイン後すぐに変更してください。');

        return 0;
    }

    private function generatePassword(): string
    {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
        $password = '';
        for ($i = 0; $i < 12; $i++) {
            $password .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $password;
    }
}
