<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('name')->unique()->comment('ロール名');
            $table->string('description')->nullable()->comment('説明');
            $table->integer('order_column')->default(0)->comment('並び順');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
