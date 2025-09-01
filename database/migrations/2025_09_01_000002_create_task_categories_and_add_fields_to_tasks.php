<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            // order for sorting categories in UI
            $table->unsignedInteger('order_column')->default(0);
            $table->timestamps();
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->unsignedBigInteger('task_category_id')->nullable()->after('is_public');
            $table->string('status')->default('未着手')->after('task_category_id');
            $table->foreign('task_category_id')
                ->references('id')
                ->on('task_categories')
                ->onUpdate('cascade')
                ->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['task_category_id']);
            $table->dropColumn(['task_category_id', 'status']);
        });

        Schema::dropIfExists('task_categories');
    }
};
