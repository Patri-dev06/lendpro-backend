<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Collector;
use App\Models\Loan;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function monthlyReleases(): JsonResponse
    {
        $data = Loan::selectRaw("TO_CHAR(release_date, 'YYYY-MM') as month, SUM(total_receivable) as releases, COUNT(*) as count")
            ->groupByRaw("TO_CHAR(release_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        return response()->json($data);
    }

    public function monthlyCollection(): JsonResponse
    {
        $data = Payment::selectRaw("TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as collected, COUNT(*) as transactions")
            ->groupByRaw("TO_CHAR(payment_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        return response()->json($data);
    }

    public function collectorSummary(Request $request): JsonResponse
    {
        $month = $request->get('month', now()->format('Y-m'));

        $collectors = Collector::with(['clients', 'loans', 'payments' => fn ($q) =>
            $q->whereRaw("TO_CHAR(payment_date, 'YYYY-MM') = ?", [$month])
        ])->get()->map(function ($c) use ($month) {
            $activeLoans = $c->loans->whereNotIn('status', ['paid']);
            $collected   = $c->payments->sum('amount');

            return [
                'id'        => $c->id,
                'name'      => $c->name,
                'code'      => $c->code,
                'area'      => $c->area,
                'assigned'  => $c->clients->count(),
                'expected'  => (float) $activeLoans->sum('daily_payment') * 26,
                'collected' => (float) $collected,
                'rate'      => $activeLoans->sum('daily_payment') * 26 > 0
                    ? round($collected / ($activeLoans->sum('daily_payment') * 26) * 100, 1)
                    : 0,
                'loans'     => $c->loans->map(fn ($l) => [
                    'number'   => $l->number,
                    'balance'  => $l->current_balance,
                    'daily'    => $l->daily_payment,
                    'due_date' => $l->due_date,
                    'status'   => $l->status,
                ]),
            ];
        });

        return response()->json(['month' => $month, 'collectors' => $collectors]);
    }

    public function clientLedger(Request $request): JsonResponse
    {
        $request->validate(['loan_id' => 'required|exists:loans,id']);

        $loan = Loan::with(['client', 'collector', 'scheduleRows', 'payments'])->findOrFail($request->loan_id);

        $schedule = $loan->scheduleRows->map(fn ($row) => [
            'day'              => $row->id,
            'scheduled_date'   => $row->scheduled_date,
            'payment_date'     => $row->payment_date,
            'expected'         => $row->expected,
            'actual'           => $row->actual,
            'previous_balance' => $row->previous_balance,
            'balance_after'    => $row->balance_after,
            'status'           => $row->status,
            'remarks'          => $row->remarks,
        ]);

        return response()->json([
            'loan'         => $loan,
            'client'       => $loan->client,
            'collector'    => $loan->collector,
            'schedule'     => $schedule,
            'total_paid'   => $loan->payments->sum('amount'),
            'total_pending'=> $loan->current_balance,
        ]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $logs = \App\Models\AuditLog::with('user')
            ->when($request->action, fn ($q, $a) => $q->where('action', $a))
            ->when($request->user_id, fn ($q, $id) => $q->where('user_id', $id))
            ->orderByDesc('performed_at')
            ->limit(200)
            ->get();

        return response()->json($logs);
    }
}
