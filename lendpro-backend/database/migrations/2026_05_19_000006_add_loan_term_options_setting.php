<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')->insertOrIgnore([
            'key'         => 'loan_term_options',
            'value'       => '[30,45,60]',
            'description' => 'Available loan term options in days (JSON array)',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'loan_term_options')->delete();
    }
};
