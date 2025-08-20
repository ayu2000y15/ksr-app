<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_stock', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('inventory_item_id')->comment('在庫マスタID')->constrained()->onDelete('cascade');
            $table->string('storage_location')->comment('保管場所');
            $table->integer('quantity')->comment('在庫数');
            $table->text('memo')->nullable()->comment('メモ');
            $table->timestamp('last_stocked_at')->nullable()->comment('最終入荷日時');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_stock');
    }
};
