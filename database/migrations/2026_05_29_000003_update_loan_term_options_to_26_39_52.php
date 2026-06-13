<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')
            ->where('key', 'loan_term_options')
            ->update([
                'value'       => '[26,39,52]',
                'description' => 'Available loan term options in collection days (26=×1/5%, 39=×1.5/7.5%, 52=×2/10%)',
                'updated_at'  => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('settings')
            ->where('key', 'loan_term_options')
            ->update([
                'value'      => '[30,45,60]',
                'updated_at' => now(),
            ]);
    }
};
