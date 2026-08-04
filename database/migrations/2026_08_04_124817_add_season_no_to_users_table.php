<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('season_no')->nullable()->after('season_id')->comment('シーズン内連番（表示用ID）');
            $table->unique(['season_id', 'season_no'], 'users_season_id_season_no_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_season_id_season_no_unique');
            $table->dropColumn('season_no');
        });
    }
};
