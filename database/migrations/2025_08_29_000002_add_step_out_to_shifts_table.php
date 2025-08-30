<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('shifts', function (Blueprint $table) {
            $table->tinyInteger('step_out')->default(0)->after('shift_type')->comment('中抜けフラグ: 1 = 中抜け');
            $table->tinyInteger('meal_ticket')->default(1)->after('step_out')->comment('食券フラグ: 0 = 食券不要');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('shifts', function (Blueprint $table) {
            $table->dropColumn('step_out');
            $table->dropColumn('meal_ticket');
        });
    }
};
