<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->morphs('viewable');
            $table->timestamps();

            $table->unique(['user_id', 'viewable_id', 'viewable_type'], 'post_view_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_views');
    }
};
