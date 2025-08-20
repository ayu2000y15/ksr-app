<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('damaged_inventories', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('inventory_item_id')->comment('在庫マスタID')->constrained()->onDelete('cascade');
            $table->foreignId('handler_user_id')->comment('対応ユーザーID')->constrained('users')->onDelete('cascade');
            $table->string('management_number')->unique()->nullable()->comment('管理番号');
            $table->date('damaged_at')->comment('破損日');
            $table->foreignId('damage_condition_id')->comment('破損状態ID')->constrained()->onDelete('cascade');
            $table->string('damaged_area')->nullable()->comment('破損箇所');
            $table->string('customer_name')->nullable()->comment('顧客名');
            $table->string('customer_phone')->nullable()->comment('顧客電話番号');
            $table->integer('compensation_amount')->nullable()->comment('弁済金額');
            $table->string('payment_method')->nullable()->comment('支払い方法');
            $table->string('receipt_number')->nullable()->comment('レシート番号');
            $table->string('receipt_image_path')->nullable()->comment('レシート写真パス');
            $table->text('memo')->nullable()->comment('メモ');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('damaged_inventories');
    }
};
