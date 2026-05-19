<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Collector;
use App\Models\Loan;
use App\Models\Payment;
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

        $monthlyReleases = Loan::selectRaw("TO_CHAR(release_date, 'YYYY-MM') as month, SUM(total_receivable) as releases")
            ->groupByRaw("TO_CHAR(release_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        $monthlyCollection = Payment::selectRaw("TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as collected")
            ->groupByRaw("TO_CHAR(payment_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        $collectorStats = Collector::with(['loans', 'payments'])->get()->map(function ($c) {
            $activeLoans = $c->loans->whereNotIn('status', ['paid']);
            $actual      = $c->payments->filter(fn ($p) => \Carbon\Carbon::parse($p->payment_date)->isToday())->sum('amount');
            return [
                'id'       => $c->id,
                'name'     => $c->name,
                'code'     => $c->code,
                'area'     => $c->area,
                'assigned' => $c->clients()->count(),
                'expected' => (float) $activeLoans->sum('daily_payment'),
                'actual'   => (float) $actual,
                'missed'   => $activeLoans->whereIn('status', ['overdue'])->count(),
                'overdue'  => $activeLoans->where('status', 'overdue')->count(),
                'past_due' => $activeLoans->where('status', 'past-due')->count(),
            ];
        });

        return response()->json([
            'counts' => [
                'active'   => $loans->whereNotIn('status', ['paid'])->count(),
                'new'      => $clients->where('type', 'new')->count(),
                'renew'    => $clients->where('type', 'renew')->count(),
                'overdue'  => $loans->where('status', 'overdue')->count(),
                'past_due' => $loans->where('status', 'past-due')->count(),
                'paid'     => $loans->where('status', 'paid')->count(),
            ],
            'financials' => [
                'total_receivable'      => $totalReceivable,
                'total_outstanding'     => $totalOutstanding,
                'total_collected'       => $totalCollected,
                'collection_efficiency' => $efficiency,
            ],
            'monthly_releases'   => $monthlyReleases,
            'monthly_collection' => $monthlyCollection,
            'collector_stats'    => $collectorStats,
            'loans'              => $loans,
        ]);
    }
}
