<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('audience')->default('all')->after('is_public'); // 'all' or 'restricted'
        });

        Schema::create('post_role', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_id');
            $table->unsignedBigInteger('role_id');
            $table->timestamps();
            $table->index(['post_id']);
            $table->index(['role_id']);
            $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
            // role table is provided by spatie
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
        });

        Schema::create('post_user', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
            $table->index(['post_id']);
            $table->index(['user_id']);
            $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('audience');
        });
        Schema::dropIfExists('post_role');
        Schema::dropIfExists('post_user');
    }
};
