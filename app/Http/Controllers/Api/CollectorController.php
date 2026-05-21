<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Collector;
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
        $activeLoans = $collector->loans->whereNotIn('status', ['paid']);
        $todayActual = $collector->payments()->whereDate('payment_date', today())->sum('amount');

        return response()->json([
            'id'       => $collector->id,
            'name'     => $collector->name,
            'code'     => $collector->code,
            'area'     => $collector->area,
            'assigned' => $collector->clients()->count(),
            'expected' => (float) $activeLoans->sum('daily_payment'),
            'actual'   => (float) $todayActual,
            'missed'   => (int) $activeLoans->where('status', 'overdue')->count(),
            'overdue'  => (int) $activeLoans->where('status', 'overdue')->count(),
            'past_due' => (int) $activeLoans->where('status', 'past-due')->count(),
            'clients'  => $collector->clients()->with('loans')->get(),
            'loans'    => $collector->loans()->with('client')->get(),
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
