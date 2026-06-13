<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('number')->unique();
            $table->string('name');
            $table->string('store_name');
            $table->string('address');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->enum('type', ['new', 'renew'])->default('new');
            $table->foreignId('collector_id')->constrained()->restrictOnDelete();
            $table->enum('status', ['new', 'renew', 'overdue', 'past-due', 'paid'])->default('new');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
