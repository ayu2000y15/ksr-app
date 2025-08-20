<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('name')->comment('仕入れ先名');
            $table->string('contact_person')->nullable()->comment('担当者名');
            $table->string('phone_number')->nullable()->comment('電話番号');
            $table->string('address')->nullable()->comment('住所');
            $table->integer('order_column')->default(0)->comment('並び順');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
