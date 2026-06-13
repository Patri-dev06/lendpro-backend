<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Collector;
use App\Models\Loan;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $loans   = Loan::with(['client', 'collector'])->get();
        $clients = Client::all();

        $totalReceivable  = $loans->sum('total_receivable');
        $totalOutstanding = $loans->sum('current_balance');
        $totalCollected   = $totalReceivable - $totalOutstanding;
        $efficiency       = $totalReceivable > 0
            ? round(($totalCollected / $totalReceivable) * 100)
            : 0;

        $activeLoans   = $loans->whereNotIn('status', ['paid']);
        $overdueLoans  = $loans->where('status', 'overdue');
        $pastDueLoans  = $loans->where('status', 'past-due');
        $expectedDaily = (float) $activeLoans->sum('daily_payment');

        // Period boundaries
        $weekStart  = Carbon::now()->startOfWeek();
        $monthStart = Carbon::now()->startOfMonth();
        $yearStart  = Carbon::now()->startOfYear();

        $allPayments        = Payment::all();
        $collectedToday     = (float) $allPayments->filter(fn ($p) => Carbon::parse($p->payment_date)->isToday())->sum('amount');
        $collectedThisWeek  = (float) $allPayments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($weekStart))->sum('amount');
        $collectedThisMonth = (float) $allPayments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($monthStart))->sum('amount');
        $collectedThisYear  = (float) $allPayments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($yearStart))->sum('amount');

        $monthlyReleases = Loan::selectRaw("TO_CHAR(release_date, 'YYYY-MM') as month, SUM(total_receivable) as releases")
            ->groupByRaw("TO_CHAR(release_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        $monthlyCollection = Payment::selectRaw("TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as collected")
            ->groupByRaw("TO_CHAR(payment_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        $monthlyReleasesByType = Loan::selectRaw("
            TO_CHAR(release_date, 'YYYY-MM') as month,
            COUNT(*) FILTER (WHERE loan_type = 'new-loan')    AS new_count,
            COUNT(*) FILTER (WHERE loan_type = 'reloan')      AS reloan_count,
            COUNT(*) FILTER (WHERE loan_type = 'reconstruct') AS reconstruct_count,
            COUNT(*)                                           AS total_count
        ")
        ->whereNotNull('release_date')
        ->groupByRaw("TO_CHAR(release_date, 'YYYY-MM')")
        ->orderBy('month')
        ->get();

        $collectorStats = Collector::with(['loans', 'payments'])->get()
            ->map(function ($c) use ($weekStart, $monthStart, $yearStart) {
                $activeLoans   = $c->loans->whereNotIn('status', ['paid']);
                $payments      = $c->payments;
                $expectedDaily = (float) $activeLoans->sum('daily_payment');

                $colToday = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->isToday())->sum('amount');
                $colWeek  = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($weekStart))->sum('amount');
                $colMonth = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($monthStart))->sum('amount');
                $colYear  = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($yearStart))->sum('amount');

                return [
                    'id'              => $c->id,
                    'name'            => $c->name,
                    'code'            => $c->code,
                    'area'            => $c->area,
                    'assigned'        => $c->clients()->count(),
                    'expected_daily'  => round($expectedDaily, 2),
                    'expected_month'  => round($expectedDaily * 26, 2),
                    'collected_today' => round($colToday, 2),
                    'collected_week'  => round($colWeek, 2),
                    'collected_month' => round($colMonth, 2),
                    'collected_year'  => round($colYear, 2),
                    'overdue'         => $activeLoans->where('status', 'overdue')->count(),
                    'past_due'        => $activeLoans->where('status', 'past-due')->count(),
                ];
            });

        return response()->json([
            'counts' => [
                'active'        => $activeLoans->count(),
                'new'           => $loans->where('loan_type', 'new-loan')->whereNotIn('status', ['paid'])->count(),
                'renew'         => $loans->where('loan_type', 'reloan')->whereNotIn('status', ['paid'])->count(),
                'reconstruct'   => $loans->where('loan_type', 'reconstruct')->whereNotIn('status', ['paid'])->count(),
                'overdue'       => $overdueLoans->count(),
                'past_due'      => $pastDueLoans->count(),
                'paid'          => $loans->where('status', 'paid')->count(),
                'total_clients' => $clients->count(),
            ],
            'financials' => [
                'total_receivable'      => $totalReceivable,
                'total_outstanding'     => $totalOutstanding,
                'total_collected'       => $totalCollected,
                'collection_efficiency' => $efficiency,
                'overdue_balance'       => round((float) $overdueLoans->sum('current_balance'), 2),
                'past_due_balance'      => round((float) $pastDueLoans->sum('current_balance'), 2),
                'expected_daily'        => round($expectedDaily, 2),
                'collected_today'       => round($collectedToday, 2),
                'collected_this_week'   => round($collectedThisWeek, 2),
                'collected_this_month'  => round($collectedThisMonth, 2),
                'collected_this_year'   => round($collectedThisYear, 2),
            ],
            'monthly_releases'          => $monthlyReleases,
            'monthly_collection'        => $monthlyCollection,
            'monthly_releases_by_type'  => $monthlyReleasesByType,
            'collector_stats'           => $collectorStats,
            'loans'                     => $loans,
        ]);
    }
}
