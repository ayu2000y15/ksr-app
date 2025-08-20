<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('name')->comment('名称');
            $table->foreignId('category_id')->comment('カテゴリID')->constrained('inventory_categories')->onDelete('cascade');
            $table->foreignId('supplier_id')->nullable()->comment('仕入れ先ID')->constrained('suppliers')->onDelete('set null');
            $table->string('size')->nullable()->comment('サイズ');
            $table->string('unit')->nullable()->comment('単位');
            $table->text('memo')->nullable()->comment('メモ');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
