<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_stock_logs', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('inventory_stock_id')->comment('在庫ID')->constrained('inventory_stock')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->comment('変更ユーザーID')->constrained()->onDelete('set null');
            $table->dateTime('change_date')->comment('変更日時');
            $table->integer('quantity_before')->comment('変更前の数量');
            $table->integer('quantity_after')->comment('変更後の数量');
            $table->string('reason')->nullable()->comment('変動理由');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_stock_logs');
    }
};
