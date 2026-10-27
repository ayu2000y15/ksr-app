<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 貸出履歴（rentals）があってもユーザーを削除できるようにするための外部キー変更。
 *
 *  - user_id        (貸出先本人)   : restrict -> cascade  … ユーザー削除時に本人の貸出記録も削除
 *  - rental_user_id (貸出対応者)   : restrict -> set null … 他人の貸出記録は残し、対応者参照だけ解除（nullable 化）
 *  - return_user_id (返却対応者)   : restrict -> set null … 同上（元から nullable）
 */
return new class extends Migration
{
    public function up(): void
    {
        // 既存の外部キーを一旦削除
        Schema::table('rentals', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['rental_user_id']);
            $table->dropForeign(['return_user_id']);
        });

        // 対応者を削除時に null にできるよう nullable へ変更
        Schema::table('rentals', function (Blueprint $table) {
            $table->foreignId('rental_user_id')->nullable()->comment('貸出対応者ID')->change();
        });

        // 新しい挙動で外部キーを張り直す
        Schema::table('rentals', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('rental_user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('return_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('rentals', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['rental_user_id']);
            $table->dropForeign(['return_user_id']);
        });

        // rental_user_id を NOT NULL へ戻す（null が残っている場合は事前に補正が必要）
        Schema::table('rentals', function (Blueprint $table) {
            $table->foreignId('rental_user_id')->nullable(false)->comment('貸出対応者ID')->change();
        });

        Schema::table('rentals', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->onDelete('restrict');
            $table->foreign('rental_user_id')->references('id')->on('users')->onDelete('restrict');
            $table->foreign('return_user_id')->references('id')->on('users')->onDelete('restrict');
        });
    }
};
