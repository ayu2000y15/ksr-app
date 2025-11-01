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
        Schema::create('rentals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict')->comment('貸出を受けるユーザーID');
            $table->foreignId('rental_item_id')->constrained('rental_items')->onDelete('restrict')->comment('貸出物マスタID');
            $table->date('rental_date')->comment('貸出日');
            $table->foreignId('rental_user_id')->constrained('users')->onDelete('restrict')->comment('貸出対応者ID');
            $table->date('return_date')->nullable()->comment('返却日');
            $table->foreignId('return_user_id')->nullable()->constrained('users')->onDelete('restrict')->comment('返却対応者ID');
            $table->text('notes')->nullable()->comment('備考');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rentals');
    }
};
