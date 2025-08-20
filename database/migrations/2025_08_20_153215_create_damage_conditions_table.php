<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('damage_conditions', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('condition')->comment('状態');
            $table->integer('order_column')->default(0)->comment('並び順');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('damage_conditions');
    }
};
