<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CollectorController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/* ---------- Public ---------- */
Route::post('auth/login',    [AuthController::class, 'login']);
Route::post('auth/register', [AuthController::class, 'register']);

/* ---------- Protected ---------- */
Route::middleware('auth:sanctum')->group(function () {

    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me',      [AuthController::class, 'me']);

    /* Notifications (all authenticated users) */
    Route::get('notifications',            [NotificationController::class, 'index']);
    Route::post('notifications/mark-read', [NotificationController::class, 'markRead']);

    /* Dashboard (all authenticated users) */
    Route::get('dashboard/stats', [DashboardController::class, 'stats']);

    /* ── Clients ── */
    Route::middleware('role:admin,manager,accounting_clerk,collector')->group(function () {
        Route::get('clients',        [ClientController::class, 'index']);
        Route::get('clients/{client}',[ClientController::class, 'show']);
    });
    Route::middleware('role:admin')->group(function () {
        Route::post('clients',              [ClientController::class, 'store']);
        Route::put('clients/{client}',      [ClientController::class, 'update']);
        Route::patch('clients/{client}',    [ClientController::class, 'update']);
        Route::delete('clients/{client}',   [ClientController::class, 'destroy']);
    });

    /* ── Collectors ── */
    Route::middleware('role:admin,manager,accounting_clerk')->group(function () {
        Route::get('collectors',             [CollectorController::class, 'index']);
        Route::get('collectors/{collector}', [CollectorController::class, 'show']);
    });
    Route::middleware('role:admin')->group(function () {
        Route::post('collectors',                    [CollectorController::class, 'store']);
        Route::put('collectors/{collector}',         [CollectorController::class, 'update']);
        Route::patch('collectors/{collector}',       [CollectorController::class, 'update']);
        Route::delete('collectors/{collector}',      [CollectorController::class, 'destroy']);
    });

    /* ── Loans ── */
    Route::middleware('role:admin,manager')->group(function () {
        Route::get('loans',         [LoanController::class, 'index']);
        Route::get('loans/{loan}',  [LoanController::class, 'show']);
        Route::get('loans/{loan}/schedule', [LoanController::class, 'schedule']);
    });
    Route::middleware('role:admin')->group(function () {
        Route::post('loans',                              [LoanController::class, 'store']);
        Route::put('loans/{loan}',                        [LoanController::class, 'update']);
        Route::patch('loans/{loan}',                      [LoanController::class, 'update']);
        Route::delete('loans/{loan}',                     [LoanController::class, 'destroy']);
        Route::post('loans/{loan}/schedule/regenerate',   [LoanController::class, 'regenerateSchedule']);
    });

    /* ── Payments ── */
    Route::middleware('role:admin,manager,accounting_clerk,collector')->group(function () {
        Route::get('payments',           [PaymentController::class, 'index']);
        Route::get('payments/{payment}', [PaymentController::class, 'show']);
        Route::get('payments/collector-summary', [PaymentController::class, 'collectorSummary']);
    });
    Route::middleware('role:admin,accounting_clerk,collector')->group(function () {
        Route::post('payments',              [PaymentController::class, 'store']);
        Route::patch('payments/{payment}',   [PaymentController::class, 'update']);
        Route::delete('payments/{payment}',  [PaymentController::class, 'destroy']);
        Route::post('payments/upload',       [PaymentController::class, 'uploadCsv']);
    });

    /* ── Users ── */
    Route::middleware('role:admin,sysadmin')->group(function () {
        Route::apiResource('users', UserController::class);
    });

    /* ── Settings ── */
    Route::middleware('role:admin,sysadmin')->group(function () {
        Route::get('settings',   [SettingController::class, 'index']);
        Route::patch('settings', [SettingController::class, 'update']);
    });

    /* ── Reports ── */
    Route::middleware('role:admin,manager,accounting_clerk')->prefix('reports')->group(function () {
        Route::get('monthly-releases',   [ReportController::class, 'monthlyReleases']);
        Route::get('monthly-collection', [ReportController::class, 'monthlyCollection']);
        Route::get('collector-summary',  [ReportController::class, 'collectorSummary']);
        Route::get('client-ledger',      [ReportController::class, 'clientLedger']);
    });
    Route::middleware('role:admin,manager,sysadmin')->prefix('reports')->group(function () {
        Route::get('audit-logs', [ReportController::class, 'auditLogs']);
    });
});
