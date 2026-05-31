<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Back up the database to the external HDD every day at 2:00 AM.
Schedule::command('db:backup')->dailyAt('02:00');

// Mark overdue/past-due loans and apply compound penalties every day at 00:05 AM.
Schedule::command('loans:process-statuses')->dailyAt('00:05');
