<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_check");
        DB::statement("ALTER TABLE loans ADD CONSTRAINT loans_status_check CHECK (status IN ('new', 'renew', 'overdue', 'past-due', 'paid', 'pending'))");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_check");
        DB::statement("ALTER TABLE loans ADD CONSTRAINT loans_status_check CHECK (status IN ('new', 'renew', 'overdue', 'past-due', 'paid'))");
    }
};
