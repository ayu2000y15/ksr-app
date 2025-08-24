<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->morphs('reactable'); // reactable_id, reactable_type
            $table->string('emoji', 64);
            $table->timestamps();

            $table->unique(['user_id', 'reactable_id', 'reactable_type', 'emoji'], 'post_reaction_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_reactions');
    }
};
