<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('real_estate_agents', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('name')->comment('会社名');
            $table->integer('order_column')->default(0)->comment('並び順');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('real_estate_agents');
    }
};
