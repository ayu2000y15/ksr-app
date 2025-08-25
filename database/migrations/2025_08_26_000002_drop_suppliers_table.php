<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Remove foreign key on inventory_items.supplier_id if exists, then drop suppliers table.
        if (Schema::hasTable('inventory_items')) {
            Schema::table('inventory_items', function (Blueprint $table) {
                // Attempt to drop foreign key; name may vary, so use dropForeign if exists.
                try {
                    $table->dropForeign(['supplier_id']);
                } catch (\Exception $e) {
                    // ignore if foreign key doesn't exist or can't be dropped
                }
            });
        }

        Schema::dropIfExists('suppliers');
    }

    public function down()
    {
        // Recreate the suppliers table. Adjust columns to match the original migration.
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('url')->nullable();
            $table->timestamps();
        });
    }
};
