<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('name')->comment('名前');
            $table->string('email')->unique()->comment('メールアドレス');
            $table->string('phone_number')->nullable()->comment('電話番号');
            $table->string('password')->comment('パスワード');
            $table->string('line_name')->nullable()->comment('LINE名');
            $table->enum('status', ['active', 'retired', 'shared'])->default('active')->comment('ステータス');
            $table->text('memo')->nullable()->comment('メモ');
            $table->timestamp('email_verified_at')->nullable()->comment('メール認証日時');
            $table->boolean('must_change_password')->default(true)->comment('パスワード変更フラグ');
            $table->rememberToken()->comment('ログイン記憶トークン');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
