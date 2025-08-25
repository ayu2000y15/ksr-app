<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            if (!Schema::hasColumn('inventory_items', 'catalog_name')) {
                $table->string('catalog_name')->nullable()->after('supplier_text');
            }
        });
    }

    public function down()
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            if (Schema::hasColumn('inventory_items', 'catalog_name')) {
                $table->dropColumn('catalog_name');
            }
        });
    }
};
