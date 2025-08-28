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
            // 性別: デフォルトは未選択のため nullable
            $table->string('gender')->nullable()->after('line_name');
            // 車の有無: デフォルトは無 (false)
            $table->boolean('has_car')->default(false)->after('gender');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['gender', 'has_car']);
        });
    }
};
