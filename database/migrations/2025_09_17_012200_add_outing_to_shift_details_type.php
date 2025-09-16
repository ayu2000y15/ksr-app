<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration updates the `type` enum on `shift_details` to include 'outing'.
     * It uses raw SQL because altering ENUMs in a portable way depends on the DB driver.
     */
    public function up()
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            // add 'outing' to the enum
            DB::statement("ALTER TABLE `shift_details` MODIFY `type` ENUM('work','break','outing') NOT NULL DEFAULT 'work'");
        } elseif ($driver === 'sqlite') {
            // sqlite: nothing to do for enum-like text columns; assume text
            // if the column is text we are fine; otherwise skip
        } else {
            // postgres: use ALTER TYPE if enum type is used (advanced); skip for now
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            // remove 'outing' by restoring original enum
            DB::statement("ALTER TABLE `shift_details` MODIFY `type` ENUM('work','break') NOT NULL DEFAULT 'work'");
        }
    }
};
