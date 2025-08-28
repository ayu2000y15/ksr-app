<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('room_occupancies') && Schema::hasColumn('room_occupancies', 'user_id')) {
            Schema::table('room_occupancies', function (Blueprint $table) {
                // try to drop foreign key if it exists, then drop the column
                try {
                    $table->dropForeign(['user_id']);
                } catch (\Throwable $e) {
                    // ignore if FK does not exist
                }
                if (Schema::hasColumn('room_occupancies', 'user_id')) {
                    $table->dropColumn('user_id');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('room_occupancies') && !Schema::hasColumn('room_occupancies', 'user_id')) {
            Schema::table('room_occupancies', function (Blueprint $table) {
                $table->foreignId('user_id')->comment('入寮ユーザーID')->constrained()->onDelete('cascade')->after('property_id');
            });
        }
    }
};
