<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        // Seed default settings
        DB::table('settings')->insert([
            ['key' => 'company_name',    'value' => 'BuenaMano Lending Corporation', 'description' => 'Displayed on reports and documents',   'created_at' => now(), 'updated_at' => now()],
            ['key' => 'company_address', 'value' => null,                             'description' => 'Company address for printed documents', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'company_phone',   'value' => null,                             'description' => 'Contact number',                        'created_at' => now(), 'updated_at' => now()],
            ['key' => 'company_email',   'value' => null,                             'description' => 'Contact email',                         'created_at' => now(), 'updated_at' => now()],
            ['key' => 'default_interest_rate', 'value' => '20',                      'description' => 'Default interest rate (%)',              'created_at' => now(), 'updated_at' => now()],
            ['key' => 'default_service_charge', 'value' => '0',                      'description' => 'Default service charge (₱)',             'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
