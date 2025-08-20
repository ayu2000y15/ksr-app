<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_furniture', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('property_id')->comment('物件ID')->constrained()->onDelete('cascade');
            $table->foreignId('furniture_master_id')->comment('家具マスタID')->constrained()->onDelete('cascade');
            $table->integer('quantity')->comment('個数');
            $table->date('removal_start_date')->nullable()->comment('搬出開始日');
            $table->date('removal_date')->nullable()->comment('搬出日');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_furniture');
    }
};
