<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rental_items', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('貸出物名');
            $table->text('description')->nullable()->comment('説明');
            $table->integer('quantity')->default(1)->comment('数量');
            $table->boolean('is_active')->default(true)->comment('有効フラグ');
            $table->integer('sort_order')->default(0)->comment('表示順');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rental_items');
    }
};
