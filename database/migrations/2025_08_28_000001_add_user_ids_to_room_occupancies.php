<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_occupancies', function (Blueprint $table) {
            if (!Schema::hasColumn('room_occupancies', 'user_ids')) {
                $table->json('user_ids')->nullable()->comment('複数ユーザーID')->after('user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('room_occupancies', function (Blueprint $table) {
            if (Schema::hasColumn('room_occupancies', 'user_ids')) {
                $table->dropColumn('user_ids');
            }
        });
    }
};
