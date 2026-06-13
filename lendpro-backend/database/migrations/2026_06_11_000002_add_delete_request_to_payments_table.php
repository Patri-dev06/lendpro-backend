<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->boolean('delete_requested')->default(false)->after('remarks');
            $table->foreignId('delete_requested_by')->nullable()->after('delete_requested')
                  ->constrained('users')->nullOnDelete();
            $table->timestamp('delete_requested_at')->nullable()->after('delete_requested_by');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['delete_requested_by']);
            $table->dropColumn(['delete_requested', 'delete_requested_by', 'delete_requested_at']);
        });
    }
};
