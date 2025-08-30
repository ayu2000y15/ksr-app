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
        Schema::table('shift_applications', function (Blueprint $table) {
            // add type column after date. Use string to allow future extensibility. Default to 'leave' to preserve existing behavior.
            $table->string('type')->default('leave')->after('date')->comment('申請の種別: leave 等');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('shift_applications', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
