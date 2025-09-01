<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_categories', function (Blueprint $table) {
            // store color as hex code like #RRGGBB
            $table->string('color', 7)->nullable()->after('order_column');
        });
    }

    public function down(): void
    {
        Schema::table('task_categories', function (Blueprint $table) {
            $table->dropColumn('color');
        });
    }
};
