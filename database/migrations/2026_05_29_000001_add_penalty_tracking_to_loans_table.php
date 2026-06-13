<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->date('overdue_since')->nullable()->after('status');
            $table->date('past_due_since')->nullable()->after('overdue_since');
            $table->date('last_penalty_at')->nullable()->after('past_due_since');
        });
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->dropColumn(['overdue_since', 'past_due_since', 'last_penalty_at']);
        });
    }
};
