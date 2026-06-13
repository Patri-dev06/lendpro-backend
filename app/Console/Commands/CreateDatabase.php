<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PDO;
use PDOException;

class CreateDatabase extends Command
{
    protected $signature   = 'db:create';
    protected $description = 'Create the PostgreSQL database if it does not exist';

    public function handle(): int
    {
        $config   = config('database.connections.pgsql');
        $dbName   = $config['database'];
        $host     = $config['host'];
        $port     = $config['port'];
        $username = $config['username'];
        $password = $config['password'];

        // Connect to the default 'postgres' maintenance database to check/create
        try {
            $pdo = new PDO(
                "pgsql:host={$host};port={$port};dbname=postgres",
                $username,
                $password,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
        } catch (PDOException $e) {
            $this->error("Could not connect to PostgreSQL: {$e->getMessage()}");
            $this->line('Make sure PostgreSQL is running and your DB_USERNAME / DB_PASSWORD in .env are correct.');
            return self::FAILURE;
        }

        $stmt   = $pdo->query("SELECT 1 FROM pg_database WHERE datname = " . $pdo->quote($dbName));
        $exists = $stmt->fetchColumn();

        if ($exists) {
            $this->info("Database '{$dbName}' already exists — nothing to do.");
            return self::SUCCESS;
        }

        $pdo->exec("CREATE DATABASE " . '"' . $dbName . '"');
        $this->info("Database '{$dbName}' created successfully.");

        return self::SUCCESS;
    }
}
