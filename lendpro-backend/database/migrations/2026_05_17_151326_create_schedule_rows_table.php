<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schedule_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->date('scheduled_date');
            $table->decimal('expected', 12, 2);
            $table->decimal('actual', 12, 2)->default(0);
            $table->decimal('previous_balance', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->enum('status', ['pending', 'paid', 'partial', 'missed', 'catch-up'])->default('pending');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['loan_id', 'scheduled_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedule_rows');
    }
};
