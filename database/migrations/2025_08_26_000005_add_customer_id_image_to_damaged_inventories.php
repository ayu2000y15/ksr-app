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
        Schema::table('damaged_inventories', function (Blueprint $table) {
            $table->string('customer_id_image_path')->nullable()->after('customer_phone');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('damaged_inventories', function (Blueprint $table) {
            $table->dropColumn('customer_id_image_path');
        });
    }
};
