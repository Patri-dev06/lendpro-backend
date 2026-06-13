<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->string('number')->unique();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('collector_id')->constrained()->restrictOnDelete();
            $table->enum('loan_type', ['new-loan', 'reloan', 'reconstruct'])->default('new-loan');
            $table->decimal('principal', 12, 2);
            $table->decimal('interest', 12, 2);
            $table->decimal('service_charge', 12, 2)->default(0);
            $table->decimal('total_receivable', 12, 2);
            $table->decimal('daily_payment', 12, 2);
            $table->unsignedSmallInteger('term_days');
            $table->decimal('current_balance', 12, 2);
            $table->date('release_date');
            $table->date('due_date');
            $table->date('expected_end_date')->nullable();
            $table->enum('status', ['new', 'renew', 'overdue', 'past-due', 'paid'])->default('new');
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
