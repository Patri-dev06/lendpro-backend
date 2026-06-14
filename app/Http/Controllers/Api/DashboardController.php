<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Collector;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $today      = now()->toDateString();
        $weekStart  = now()->startOfWeek()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();
        $yearStart  = now()->startOfYear()->toDateString();

        // Loan counts and financial aggregates from DB
        $loanAgg = DB::table('loans')
            ->selectRaw("
                COUNT(*) FILTER (WHERE status NOT IN ('paid','pending'))          AS active,
                COUNT(*) FILTER (WHERE loan_type = 'new-loan' AND status NOT IN ('paid','pending'))  AS new_loans,
                COUNT(*) FILTER (WHERE loan_type = 'reloan'   AND status NOT IN ('paid','pending'))  AS renew,
                COUNT(*) FILTER (WHERE loan_type = 'reconstruct' AND status NOT IN ('paid','pending')) AS reconstruct,
                COUNT(*) FILTER (WHERE status = 'overdue')                        AS overdue,
                COUNT(*) FILTER (WHERE status = 'past-due')                       AS past_due,
                COUNT(*) FILTER (WHERE status = 'paid')                           AS paid,
                COALESCE(SUM(total_receivable), 0)                                AS total_receivable,
                COALESCE(SUM(current_balance), 0)                                 AS total_outstanding,
                COALESCE(SUM(daily_payment) FILTER (WHERE status NOT IN ('paid','pending')), 0) AS expected_daily,
                COALESCE(SUM(current_balance) FILTER (WHERE status = 'overdue'),  0) AS overdue_balance,
                COALESCE(SUM(current_balance) FILTER (WHERE status = 'past-due'), 0) AS past_due_balance
            ")
            ->whereNull('deleted_at')
            ->first();

        $totalClients = DB::table('clients')->whereNull('deleted_at')->count();

        $totalReceivable  = (float) $loanAgg->total_receivable;
        $totalOutstanding = (float) $loanAgg->total_outstanding;
        $totalCollected   = $totalReceivable - $totalOutstanding;
        $efficiency       = $totalReceivable > 0
            ? round(($totalCollected / $totalReceivable) * 100)
            : 0;

        // Payment period totals from DB
        $payAgg = DB::table('payments')
            ->selectRaw("
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date = ?::date), 0) AS today,
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date >= ?::date), 0) AS this_week,
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date >= ?::date), 0) AS this_month,
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date >= ?::date), 0) AS this_year
            ", [$today, $weekStart, $monthStart, $yearStart])
            ->whereNull('deleted_at')
            ->first();

        $monthlyReleases = DB::table('loans')
            ->selectRaw("TO_CHAR(release_date, 'YYYY-MM') as month, SUM(total_receivable) as releases")
            ->whereNull('deleted_at')
            ->groupByRaw("TO_CHAR(release_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        $monthlyCollection = DB::table('payments')
            ->selectRaw("TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as collected")
            ->whereNull('deleted_at')
            ->groupByRaw("TO_CHAR(payment_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        $monthlyReleasesByType = DB::table('loans')
            ->selectRaw("
                TO_CHAR(release_date, 'YYYY-MM') as month,
                COUNT(*) FILTER (WHERE loan_type = 'new-loan')    AS new_count,
                COUNT(*) FILTER (WHERE loan_type = 'reloan')      AS reloan_count,
                COUNT(*) FILTER (WHERE loan_type = 'reconstruct') AS reconstruct_count,
                COUNT(*)                                           AS total_count
            ")
            ->whereNotNull('release_date')
            ->whereNull('deleted_at')
            ->groupByRaw("TO_CHAR(release_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        // Collector stats via DB aggregation
        $collectorPayAgg = DB::table('payments')
            ->selectRaw("
                collector_id,
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date = ?::date), 0) AS today,
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date >= ?::date), 0) AS this_week,
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date >= ?::date), 0) AS this_month,
                COALESCE(SUM(amount) FILTER (WHERE payment_date::date >= ?::date), 0) AS this_year
            ", [$today, $weekStart, $monthStart, $yearStart])
            ->whereNull('deleted_at')
            ->groupBy('collector_id')
            ->get()
            ->keyBy('collector_id');

        $collectorLoanAgg = DB::table('loans')
            ->selectRaw("
                collector_id,
                COALESCE(SUM(daily_payment) FILTER (WHERE status NOT IN ('paid','pending')), 0) AS expected_daily,
                COUNT(*) FILTER (WHERE status = 'overdue')                                       AS overdue,
                COUNT(*) FILTER (WHERE status = 'past-due')                                      AS past_due
            ")
            ->whereNull('deleted_at')
            ->groupBy('collector_id')
            ->get()
            ->keyBy('collector_id');

        $collectorClientCounts = DB::table('clients')
            ->selectRaw('collector_id, COUNT(*) AS assigned')
            ->whereNull('deleted_at')
            ->groupBy('collector_id')
            ->get()
            ->keyBy('collector_id');

        $collectorStats = Collector::orderBy('name')->get()->map(function ($c) use (
            $collectorPayAgg,
            $collectorLoanAgg,
            $collectorClientCounts,
        ) {
            $pay  = $collectorPayAgg->get($c->id);
            $loan = $collectorLoanAgg->get($c->id);
            $cli  = $collectorClientCounts->get($c->id);

            $expectedDaily = (float) ($loan->expected_daily ?? 0);

            return [
                'id'              => $c->id,
                'name'            => $c->name,
                'code'            => $c->code,
                'area'            => $c->area,
                'assigned'        => (int) ($cli->assigned ?? 0),
                'expected_daily'  => round($expectedDaily, 2),
                'expected_month'  => round($expectedDaily * 26, 2),
                'collected_today' => round((float) ($pay->today ?? 0), 2),
                'collected_week'  => round((float) ($pay->this_week ?? 0), 2),
                'collected_month' => round((float) ($pay->this_month ?? 0), 2),
                'collected_year'  => round((float) ($pay->this_year ?? 0), 2),
                'overdue'         => (int) ($loan->overdue ?? 0),
                'past_due'        => (int) ($loan->past_due ?? 0),
            ];
        });

        return response()->json([
            'counts' => [
                'active'        => (int) $loanAgg->active,
                'new'           => (int) $loanAgg->new_loans,
                'renew'         => (int) $loanAgg->renew,
                'reconstruct'   => (int) $loanAgg->reconstruct,
                'overdue'       => (int) $loanAgg->overdue,
                'past_due'      => (int) $loanAgg->past_due,
                'paid'          => (int) $loanAgg->paid,
                'total_clients' => $totalClients,
            ],
            'financials' => [
                'total_receivable'      => round($totalReceivable, 2),
                'total_outstanding'     => round($totalOutstanding, 2),
                'total_collected'       => round($totalCollected, 2),
                'collection_efficiency' => $efficiency,
                'overdue_balance'       => round((float) $loanAgg->overdue_balance, 2),
                'past_due_balance'      => round((float) $loanAgg->past_due_balance, 2),
                'expected_daily'        => round((float) $loanAgg->expected_daily, 2),
                'collected_today'       => round((float) $payAgg->today, 2),
                'collected_this_week'   => round((float) $payAgg->this_week, 2),
                'collected_this_month'  => round((float) $payAgg->this_month, 2),
                'collected_this_year'   => round((float) $payAgg->this_year, 2),
            ],
            'monthly_releases'          => $monthlyReleases,
            'monthly_collection'        => $monthlyCollection,
            'monthly_releases_by_type'  => $monthlyReleasesByType,
            'collector_stats'           => $collectorStats,
        ]);
    }
}
