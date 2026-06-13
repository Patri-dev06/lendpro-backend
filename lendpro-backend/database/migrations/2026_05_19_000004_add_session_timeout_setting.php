<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')->insertOrIgnore([
            'key'         => 'session_timeout_minutes',
            'value'       => '30',
            'description' => 'Inactivity period (in minutes) before users are automatically signed out',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'session_timeout_minutes')->delete();
    }
};
