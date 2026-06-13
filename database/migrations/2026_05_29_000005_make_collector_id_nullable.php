<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->foreignId('collector_id')->nullable()->change();
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('collector_id')->nullable()->change();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('collector_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->foreignId('collector_id')->nullable(false)->change();
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('collector_id')->nullable(false)->change();
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('collector_id')->nullable(false)->change();
        });
    }
};
