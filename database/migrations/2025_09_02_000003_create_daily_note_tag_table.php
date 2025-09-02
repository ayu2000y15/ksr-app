<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_note_tag', function (Blueprint $table) {
            $table->id();
            $table->foreignId('daily_note_id')->constrained('daily_notes')->onDelete('cascade');
            $table->foreignId('tag_id')->constrained('tags')->onDelete('cascade');
            $table->unique(['daily_note_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_note_tag');
    }
};
