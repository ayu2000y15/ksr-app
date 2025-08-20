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

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
