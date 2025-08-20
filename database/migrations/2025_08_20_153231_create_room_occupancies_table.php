<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_occupancies', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('property_id')->comment('物件ID')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->comment('入寮ユーザーID')->constrained()->onDelete('cascade');
            $table->date('move_in_date')->comment('入寮日');
            $table->date('move_out_date')->nullable()->comment('退寮日');
            $table->foreignId('final_move_out_user_id')->nullable()->comment('最終退寮者ID')->constrained('users')->onDelete('set null');
            $table->foreignId('checkout_user_id')->nullable()->comment('退去確認者ID')->constrained('users')->onDelete('set null');
            $table->date('checkout_date')->nullable()->comment('退去確認日');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_occupancies');
    }
};
