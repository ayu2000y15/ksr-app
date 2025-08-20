<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->id()->comment('ID');
            $table->morphs('attachable'); // attachable_id, attachable_type
            $table->string('file_path')->comment('ファイルパス');
            $table->string('original_name')->comment('元ファイル名');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};
