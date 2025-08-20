<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->string('name')->comment('物件名');
            $table->foreignId('real_estate_agent_id')->comment('不動産会社ID')->constrained()->onDelete('cascade');
            $table->string('postal_code', 8)->nullable()->comment('郵便番号');
            $table->string('address')->comment('住所');
            $table->boolean('has_parking')->comment('駐車場有無');
            $table->string('layout')->nullable()->comment('間取り');
            $table->date('contract_date')->comment('物件契約日');
            $table->date('cancellation_date')->nullable()->comment('物件解約日');
            $table->text('room_details')->nullable()->comment('部屋情報');
            $table->text('memo')->nullable()->comment('メモ');
            $table->integer('order_column')->default(0)->comment('並び順');
            $table->boolean('key_returned')->default(false)->comment('鍵返却有無');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
