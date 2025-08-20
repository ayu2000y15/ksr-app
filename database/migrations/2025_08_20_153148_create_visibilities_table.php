<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visibilities', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->morphs('visible'); // visible_id, visible_type
            $table->unsignedBigInteger('target_id')->comment('対象ID (user_id or role_id)');
            $table->enum('target_type', ['user', 'role'])->comment('対象種別');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visibilities');
    }
};
