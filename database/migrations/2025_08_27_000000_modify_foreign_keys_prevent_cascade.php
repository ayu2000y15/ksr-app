<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prevent deleting a real_estate_agent when properties reference it
        Schema::table('properties', function (Blueprint $table) {
            // drop existing FK added by original migration
            $table->dropForeign(['real_estate_agent_id']);
            // re-add without cascade (use RESTRICT semantics)
            $table->foreign('real_estate_agent_id')->references('id')->on('real_estate_agents')->onDelete('restrict')->onUpdate('cascade');
        });

        // Prevent deleting a property or furniture_master when referenced in pivot
        Schema::table('property_furniture', function (Blueprint $table) {
            $table->dropForeign(['property_id']);
            $table->dropForeign(['furniture_master_id']);

            $table->foreign('property_id')->references('id')->on('properties')->onDelete('restrict')->onUpdate('cascade');
            $table->foreign('furniture_master_id')->references('id')->on('furniture_masters')->onDelete('restrict')->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        // Revert: restore cascade behavior
        Schema::table('property_furniture', function (Blueprint $table) {
            $table->dropForeign(['property_id']);
            $table->dropForeign(['furniture_master_id']);

            $table->foreign('property_id')->references('id')->on('properties')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('furniture_master_id')->references('id')->on('furniture_masters')->onDelete('cascade')->onUpdate('cascade');
        });

        Schema::table('properties', function (Blueprint $table) {
            $table->dropForeign(['real_estate_agent_id']);
            $table->foreign('real_estate_agent_id')->references('id')->on('real_estate_agents')->onDelete('cascade')->onUpdate('cascade');
        });
    }
};
