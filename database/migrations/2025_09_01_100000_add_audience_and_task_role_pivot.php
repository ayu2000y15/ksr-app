<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'audience')) {
                $table->string('audience')->default('all')->after('is_public')->comment("公開範囲: 'all' または 'restricted'");
            }
        });

        Schema::create('task_role', function (Blueprint $table) {
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('role_id');
            $table->primary(['task_id', 'role_id']);
            $table->foreign('task_id')->references('id')->on('tasks')->onDelete('cascade');
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_role');

        Schema::table('tasks', function (Blueprint $table) {
            if (Schema::hasColumn('tasks', 'audience')) {
                $table->dropColumn('audience');
            }
        });
    }
};
