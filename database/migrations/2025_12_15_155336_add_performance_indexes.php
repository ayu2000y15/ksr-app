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
        // shiftsテーブル: user_id, is_published, dateの組み合わせでよく検索される
        Schema::table('shifts', function (Blueprint $table) {
            $table->index(['user_id', 'is_published', 'date'], 'idx_shifts_user_published_date');
        });

        // shift_detailsテーブル: user_id, date, typeの組み合わせでよく検索される
        Schema::table('shift_details', function (Blueprint $table) {
            $table->index(['user_id', 'date', 'type'], 'idx_shift_details_user_date_type');
        });

        // transport_requestsテーブル: created_by, dateの組み合わせでよく検索される
        Schema::table('transport_requests', function (Blueprint $table) {
            $table->index(['created_by', 'date'], 'idx_transport_requests_created_date');
        });

        // rentalsテーブル: user_id, return_dateの組み合わせでよく検索される
        Schema::table('rentals', function (Blueprint $table) {
            $table->index(['user_id', 'return_date'], 'idx_rentals_user_return');
        });

        // holidaysテーブル: dateでよく検索される
        Schema::table('holidays', function (Blueprint $table) {
            $table->index('date', 'idx_holidays_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shifts', function (Blueprint $table) {
            $table->dropIndex('idx_shifts_user_published_date');
        });

        Schema::table('shift_details', function (Blueprint $table) {
            $table->dropIndex('idx_shift_details_user_date_type');
        });

        Schema::table('transport_requests', function (Blueprint $table) {
            $table->dropIndex('idx_transport_requests_created_date');
        });

        Schema::table('rentals', function (Blueprint $table) {
            $table->dropIndex('idx_rentals_user_return');
        });

        Schema::table('holidays', function (Blueprint $table) {
            $table->dropIndex('idx_holidays_date');
        });
    }
};
