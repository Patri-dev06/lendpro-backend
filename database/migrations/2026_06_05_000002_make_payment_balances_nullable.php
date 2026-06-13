<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('previous_balance', 12, 2)->nullable()->change();
            $table->decimal('new_balance', 12, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('previous_balance', 12, 2)->nullable(false)->change();
            $table->decimal('new_balance', 12, 2)->nullable(false)->change();
        });
    }
};
