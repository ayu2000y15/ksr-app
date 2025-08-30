<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transport_requests', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->date('date')->comment('送迎日');
            $table->string('direction')->comment('行き/帰り (to/from)');
            $table->json('driver_ids')->nullable()->comment('複数ドライバーID');
            $table->foreignId('created_by')->nullable()->comment('申請者')->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transport_requests');
    }
};
