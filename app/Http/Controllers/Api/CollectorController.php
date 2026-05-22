<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Collector;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollectorController extends Controller
{
    public function index(): JsonResponse
    {
        $collectors = Collector::with(['clients', 'loans', 'payments'])->get()->map(function ($c) {
            $activeLoans = $c->loans->whereNotIn('status', ['paid']);
            $todayStr    = today()->toDateString();
            $todayActual = $c->payments->filter(fn ($p) => substr((string) $p->payment_date, 0, 10) === $todayStr)->sum('amount');

            return [
                'id'       => $c->id,
                'name'     => $c->name,
                'code'     => $c->code,
                'area'     => $c->area,
                'assigned' => $c->clients->count(),
                'expected' => (float) $activeLoans->sum('daily_payment'),
                'actual'   => (float) $todayActual,
                'missed'   => (int) $activeLoans->where('status', 'overdue')->count(),
                'overdue'  => (int) $activeLoans->where('status', 'overdue')->count(),
                'past_due' => (int) $activeLoans->where('status', 'past-due')->count(),
            ];
        });

        return response()->json($collectors);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:collectors',
            'area' => 'required|string|max:255',
        ]);

        $collector = Collector::create($data);
        AuditLog::record('CREATE_COLLECTOR', $collector->code, "Created collector {$collector->name}");

        return response()->json($collector, 201);
    }

    public function show(Collector $collector): JsonResponse
    {
        $collector->load(['loans.client', 'payments', 'clients.loans']);

        $activeLoans  = $collector->loans->whereNotIn('status', ['paid']);
        $expectedDaily = (float) $activeLoans->sum('daily_payment');
        $payments      = $collector->payments;

        $weekStart  = Carbon::now()->startOfWeek();
        $monthStart = Carbon::now()->startOfMonth();
        $yearStart  = Carbon::now()->startOfYear();

        $collectedToday  = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->isToday())->sum('amount');
        $collectedWeek   = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($weekStart))->sum('amount');
        $collectedMonth  = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($monthStart))->sum('amount');
        $collectedYear   = (float) $payments->filter(fn ($p) => Carbon::parse($p->payment_date)->gte($yearStart))->sum('amount');

        $monthlyCollection = $collector->payments()
            ->selectRaw("TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as collected")
            ->groupByRaw("TO_CHAR(payment_date, 'YYYY-MM')")
            ->orderBy('month')
            ->get();

        $clientLoans = $collector->clients->map(function ($cl) {
            $activeLoan = $cl->loans->whereNotIn('status', ['paid'])->sortByDesc('created_at')->first();
            return [
                'id'         => $cl->id,
                'number'     => $cl->number,
                'name'       => $cl->name,
                'store_name' => $cl->store_name,
                'phone'      => $cl->phone,
                'address'    => $cl->address,
                'status'     => $cl->status,
                'loan'       => $activeLoan ? [
                    'id'              => $activeLoan->id,
                    'number'          => $activeLoan->number,
                    'loan_type'       => $activeLoan->loan_type,
                    'principal'       => $activeLoan->principal,
                    'total_receivable'=> $activeLoan->total_receivable,
                    'current_balance' => $activeLoan->current_balance,
                    'daily_payment'   => $activeLoan->daily_payment,
                    'due_date'        => $activeLoan->due_date,
                    'status'          => $activeLoan->status,
                ] : null,
            ];
        })->values();

        return response()->json([
            'id'               => $collector->id,
            'name'             => $collector->name,
            'code'             => $collector->code,
            'area'             => $collector->area,
            'assigned'         => $collector->clients->count(),
            'expected_daily'   => round($expectedDaily, 2),
            'expected_month'   => round($expectedDaily * 26, 2),
            'collected_today'  => round($collectedToday, 2),
            'collected_week'   => round($collectedWeek, 2),
            'collected_month'  => round($collectedMonth, 2),
            'collected_year'   => round($collectedYear, 2),
            'overdue'          => (int) $activeLoans->where('status', 'overdue')->count(),
            'past_due'         => (int) $activeLoans->where('status', 'past-due')->count(),
            'monthly_collection' => $monthlyCollection,
            'clients'          => $clientLoans,
        ]);
    }

    public function update(Request $request, Collector $collector): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string|max:50|unique:collectors,code,' . $collector->id,
            'area' => 'sometimes|string|max:255',
        ]);

        $collector->update($data);
        AuditLog::record('UPDATE_COLLECTOR', $collector->code, "Updated collector {$collector->name}");

        return response()->json($collector);
    }

    public function destroy(Collector $collector): JsonResponse
    {
        $collector->delete();
        return response()->json(['message' => 'Collector deleted.']);
    }
}
