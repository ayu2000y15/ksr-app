<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_shift_settings', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->unique()->comment('ユーザーID')->constrained()->onDelete('cascade');
            $table->integer('monthly_leave_limit')->comment('月間休暇上限数 (0は無制限)');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_shift_settings');
    }
};
