<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class BackupDatabase extends Command
{
    protected $signature   = 'db:backup';
    protected $description = 'Dump the PostgreSQL database to the external HDD backup directory';

    private const BACKUP_DIR     = '/mnt/lendpro-backup/postgres';
    private const RETENTION_DAYS = 30;

    public function handle(): int
    {
        $config   = config('database.connections.pgsql');
        $host     = $config['host'];
        $port     = (string) $config['port'];
        $dbName   = $config['database'];
        $username = $config['username'];
        $password = $config['password'];

        if (! is_dir(self::BACKUP_DIR)) {
            $this->error('Backup directory not found: ' . self::BACKUP_DIR);
            $this->line('Ensure the external HDD is mounted at /mnt/lendpro-backup.');
            return self::FAILURE;
        }

        $timestamp = Carbon::now()->format('Y-m-d_H-i');
        $filename  = self::BACKUP_DIR . "/{$dbName}_{$timestamp}.sql.gz";

        $this->info("Dumping '{$dbName}' → {$filename}");

        $exitCode = $this->runDump($host, $port, $username, $password, $dbName, $filename);

        if ($exitCode !== 0) {
            $this->error("pg_dump failed (exit {$exitCode}). Check PostgreSQL credentials and connectivity.");
            return self::FAILURE;
        }

        $size = $this->humanSize(filesize($filename));
        $this->info("Backup complete ({$size}).");

        $this->pruneOldBackups($dbName);

        return self::SUCCESS;
    }

    private function runDump(
        string $host,
        string $port,
        string $username,
        string $password,
        string $dbName,
        string $filename
    ): int {
        $dumpCmd = sprintf(
            'pg_dump -h %s -p %s -U %s %s',
            escapeshellarg($host),
            escapeshellarg($port),
            escapeshellarg($username),
            escapeshellarg($dbName)
        );

        $fullCmd = "bash -c " . escapeshellarg("{$dumpCmd} | gzip > " . escapeshellarg($filename));

        $process = proc_open(
            $fullCmd,
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            null,
            ['PGPASSWORD' => $password] // passed as env var, never appears in ps output
        );

        if (! is_resource($process)) {
            $this->error('Failed to start pg_dump process.');
            return 1;
        }

        fclose($pipes[0]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);

        if ($exitCode !== 0 && $stderr) {
            $this->line("<fg=red>pg_dump stderr:</> {$stderr}");
        }

        return $exitCode;
    }

    private function pruneOldBackups(string $dbName): void
    {
        $cutoff  = Carbon::now()->subDays(self::RETENTION_DAYS)->timestamp;
        $pattern = self::BACKUP_DIR . "/{$dbName}_*.sql.gz";
        $deleted = 0;

        foreach (glob($pattern) ?: [] as $file) {
            if (filemtime($file) < $cutoff) {
                unlink($file);
                $deleted++;
            }
        }

        if ($deleted > 0) {
            $this->info("Pruned {$deleted} backup(s) older than " . self::RETENTION_DAYS . ' days.');
        }
    }

    private function humanSize(int|false $bytes): string
    {
        if ($bytes === false || $bytes < 1024) {
            return ($bytes ?: 0) . ' B';
        }
        foreach (['KB', 'MB', 'GB'] as $unit) {
            $bytes /= 1024;
            if ($bytes < 1024) {
                return round($bytes, 1) . " {$unit}";
            }
        }
        return round($bytes, 1) . ' TB';
    }
}
