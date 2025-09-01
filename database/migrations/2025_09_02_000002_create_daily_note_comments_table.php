<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('daily_note_comments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('daily_note_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->text('body');
            $table->unsignedBigInteger('quote_comment_id')->nullable();
            $table->timestamps();

            $table->foreign('daily_note_id')->references('id')->on('daily_notes')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('quote_comment_id')->references('id')->on('daily_note_comments')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::dropIfExists('daily_note_comments');
    }
};
