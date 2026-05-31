<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_penalties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->date('applied_at');
            $table->decimal('balance_before',  12, 2);
            $table->decimal('interest_rate',    5, 2)->default(5.00);
            $table->decimal('penalty_rate',     5, 2)->default(3.00);
            $table->decimal('interest_amount', 12, 2);
            $table->decimal('penalty_amount',  12, 2);
            $table->decimal('total_added',     12, 2);
            $table->decimal('balance_after',   12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_penalties');
    }
};
