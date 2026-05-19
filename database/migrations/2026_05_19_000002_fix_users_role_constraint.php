<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old check constraint that excluded 'admin'
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');

        // Add the corrected constraint matching the application's role set
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'collector', 'manager', 'sysadmin', 'accounting_clerk'))");

        // Fix the default (was 'encoder' which is no longer valid)
        DB::statement("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'collector'");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('sysadmin', 'manager', 'collector', 'accounting_clerk', 'encoder'))");
        DB::statement("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'encoder'");
    }
};
