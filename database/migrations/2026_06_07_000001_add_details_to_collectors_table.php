<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collectors', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('area');
            $table->text('address')->nullable()->after('phone');
            $table->string('mothers_name')->nullable()->after('address');
            $table->string('fathers_name')->nullable()->after('mothers_name');
            $table->string('place_of_birth')->nullable()->after('fathers_name');
            $table->date('date_of_birth')->nullable()->after('place_of_birth');
            $table->string('fb_messenger')->nullable()->after('date_of_birth');
            $table->string('email')->nullable()->after('fb_messenger');
            $table->string('drivers_license')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('collectors', function (Blueprint $table) {
            $table->dropColumn([
                'phone', 'address', 'mothers_name', 'fathers_name',
                'place_of_birth', 'date_of_birth', 'fb_messenger',
                'email', 'drivers_license',
            ]);
        });
    }
};
