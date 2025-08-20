<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_applications', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->foreignId('user_id')->comment('ユーザーID')->constrained()->onDelete('cascade');
            $table->date('date')->comment('日付');
            $table->enum('status', ['pending', 'approved', 'rejected'])->comment('ステータス');
            $table->text('reason')->nullable()->comment('理由');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_applications');
    }
};
