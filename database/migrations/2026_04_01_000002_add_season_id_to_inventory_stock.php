<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_stock', function (Blueprint $table) {
            $table->foreignId('season_id')
                ->nullable()
                ->after('id')
                ->constrained('inventory_seasons')
                ->nullOnDelete()
                ->comment('シーズンID (nullは従来データ)');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_stock', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\InventorySeason::class);
            $table->dropColumn('season_id');
        });
    }
};
