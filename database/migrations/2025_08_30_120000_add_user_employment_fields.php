<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('employment_condition', ['dormitory', 'commute'])->nullable()->after('has_car');
            $table->string('commute_method')->nullable()->after('employment_condition');
            $table->time('default_start_time')->nullable()->after('commute_method');
            $table->time('default_end_time')->nullable()->after('default_start_time');
            $table->text('preferred_week_days')->nullable()->after('default_end_time');
            $table->tinyInteger('preferred_week_days_count')->nullable()->after('preferred_week_days');
            $table->string('employment_period')->nullable()->after('preferred_week_days');
            $table->text('employment_notes')->nullable()->after('employment_period');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'employment_condition',
                'commute_method',
                'default_start_time',
                'default_end_time',
                'preferred_week_days',
                'preferred_week_days_count',
                'employment_period',
                'employment_notes',
            ]);
        });
    }
};
