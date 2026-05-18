<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CollectorController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

/* ---------- Public ---------- */
Route::post('auth/login', [AuthController::class, 'login']);

/* ---------- Protected ---------- */
Route::middleware('auth:sanctum')->group(function () {

    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);

    /* Dashboard */
    Route::get('dashboard/stats', [DashboardController::class, 'stats']);

    /* Clients */
    Route::apiResource('clients', ClientController::class);

    /* Collectors */
    Route::apiResource('collectors', CollectorController::class);

    /* Loans */
    Route::get('loans/{loan}/schedule', [LoanController::class, 'schedule']);
    Route::apiResource('loans', LoanController::class);

    /* Payments */
    Route::get('payments/collector-summary', [PaymentController::class, 'collectorSummary']);
    Route::apiResource('payments', PaymentController::class)->except(['update', 'destroy']);
    Route::patch('payments/{payment}', [PaymentController::class, 'update']);
    Route::delete('payments/{payment}', [PaymentController::class, 'destroy']);

    /* Reports */
    Route::prefix('reports')->group(function () {
        Route::get('monthly-releases',   [ReportController::class, 'monthlyReleases']);
        Route::get('monthly-collection', [ReportController::class, 'monthlyCollection']);
        Route::get('collector-summary',  [ReportController::class, 'collectorSummary']);
        Route::get('client-ledger',      [ReportController::class, 'clientLedger']);
        Route::get('audit-logs',         [ReportController::class, 'auditLogs']);
    });
});
