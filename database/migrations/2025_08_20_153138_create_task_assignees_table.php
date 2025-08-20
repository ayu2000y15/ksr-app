<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_assignees', function (Blueprint $table) {
            $table->foreignId('task_id')->comment('タスクID')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->comment('担当ユーザーID')->constrained()->onDelete('cascade');
            $table->primary(['task_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_assignees');
    }
};
