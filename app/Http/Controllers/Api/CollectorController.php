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
                'id'              => $c->id,
                'name'            => $c->name,
                'first_name'      => $c->first_name,
                'middle_name'     => $c->middle_name,
                'last_name'       => $c->last_name,
                'code'            => $c->code,
                'area'            => $c->area,
                'phone'           => $c->phone,
                'address'         => $c->address,
                'mothers_name'    => $c->mothers_name,
                'fathers_name'    => $c->fathers_name,
                'place_of_birth'  => $c->place_of_birth,
                'date_of_birth'   => $c->date_of_birth,
                'fb_messenger'    => $c->fb_messenger,
                'email'           => $c->email,
                'drivers_license' => $c->drivers_license,
                'approval_status' => $c->approval_status,
                'assigned'        => $c->clients->count(),
                'expected'        => (float) $activeLoans->sum('daily_payment'),
                'actual'          => (float) $todayActual,
                'missed'          => (int) $activeLoans->where('status', 'overdue')->count(),
                'overdue'         => (int) $activeLoans->where('status', 'overdue')->count(),
                'past_due'        => (int) $activeLoans->where('status', 'past-due')->count(),
            ];
        });

        return response()->json($collectors);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name'      => 'required|string|max:255',
            'middle_name'     => 'nullable|string|max:255',
            'last_name'       => 'required|string|max:255',
            'area'            => 'required|string|max:255',
            'phone'           => 'required|string|max:20',
            'address'         => 'nullable|string',
            'mothers_name'    => 'required|string|max:255',
            'fathers_name'    => 'required|string|max:255',
            'place_of_birth'  => 'required|string|max:255',
            'date_of_birth'   => 'required|date',
            'fb_messenger'    => 'nullable|string|max:255',
            'email'           => 'nullable|email|max:255',
            'drivers_license' => 'nullable|string|max:100',
        ]);

        // Normalize to uppercase
        foreach (['first_name', 'middle_name', 'last_name', 'area', 'address', 'mothers_name', 'fathers_name', 'place_of_birth'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = strtoupper($data[$field]);
            }
        }

        // Compose full name from parts
        $nameParts    = array_filter([$data['first_name'], $data['middle_name'] ?? null, $data['last_name']]);
        $data['name'] = implode(' ', $nameParts);

        // Duplicate detection: same first+last name among approved collectors
        $dup = Collector::where('first_name', $data['first_name'])
            ->where('last_name', $data['last_name'])
            ->where('approval_status', 'approved')
            ->exists();

        $data['approval_status'] = $dup ? 'pending_approval' : 'approved';

        $collector = Collector::create(array_merge($data, ['code' => 'COLL-TEMP']));
        $collector->update(['code' => 'COLL-' . str_pad($collector->id, 4, '0', STR_PAD_LEFT)]);
        $collector->refresh();

        AuditLog::record(
            'CREATE_COLLECTOR',
            $collector->code,
            "Created collector {$collector->name}" . ($dup ? ' — pending approval (duplicate name)' : '')
        );

        return response()->json($collector, 201);
    }

    public function show(Collector $collector): JsonResponse
    {
        $collector->load(['loans.client', 'payments', 'clients.loans']);

        $activeLoans   = $collector->loans->whereNotIn('status', ['paid']);
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
                    'id'               => $activeLoan->id,
                    'number'           => $activeLoan->number,
                    'loan_type'        => $activeLoan->loan_type,
                    'principal'        => $activeLoan->principal,
                    'total_receivable' => $activeLoan->total_receivable,
                    'current_balance'  => $activeLoan->current_balance,
                    'daily_payment'    => $activeLoan->daily_payment,
                    'due_date'         => $activeLoan->due_date,
                    'status'           => $activeLoan->status,
                ] : null,
            ];
        })->values();

        return response()->json([
            'id'                 => $collector->id,
            'name'               => $collector->name,
            'code'               => $collector->code,
            'area'               => $collector->area,
            'phone'              => $collector->phone,
            'address'            => $collector->address,
            'mothers_name'       => $collector->mothers_name,
            'fathers_name'       => $collector->fathers_name,
            'place_of_birth'     => $collector->place_of_birth,
            'date_of_birth'      => $collector->date_of_birth,
            'fb_messenger'       => $collector->fb_messenger,
            'email'              => $collector->email,
            'drivers_license'    => $collector->drivers_license,
            'approval_status'    => $collector->approval_status,
            'assigned'           => $collector->clients->count(),
            'expected_daily'     => round($expectedDaily, 2),
            'expected_month'     => round($expectedDaily * 26, 2),
            'collected_today'    => round($collectedToday, 2),
            'collected_week'     => round($collectedWeek, 2),
            'collected_month'    => round($collectedMonth, 2),
            'collected_year'     => round($collectedYear, 2),
            'overdue'            => (int) $activeLoans->where('status', 'overdue')->count(),
            'past_due'           => (int) $activeLoans->where('status', 'past-due')->count(),
            'monthly_collection' => $monthlyCollection,
            'clients'            => $clientLoans,
        ]);
    }

    public function update(Request $request, Collector $collector): JsonResponse
    {
        $data = $request->validate([
            'first_name'      => 'sometimes|string|max:255',
            'middle_name'     => 'nullable|string|max:255',
            'last_name'       => 'sometimes|string|max:255',
            'area'            => 'sometimes|string|max:255',
            'phone'           => 'nullable|string|max:20',
            'address'         => 'nullable|string',
            'mothers_name'    => 'nullable|string|max:255',
            'fathers_name'    => 'nullable|string|max:255',
            'place_of_birth'  => 'nullable|string|max:255',
            'date_of_birth'   => 'nullable|date',
            'fb_messenger'    => 'nullable|string|max:255',
            'email'           => 'nullable|email|max:255',
            'drivers_license' => 'nullable|string|max:100',
        ]);

        // Normalize to uppercase
        foreach (['first_name', 'middle_name', 'last_name', 'area', 'address', 'mothers_name', 'fathers_name', 'place_of_birth'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = strtoupper($data[$field]);
            }
        }

        // Recompose full name if any name part is being updated
        $firstName  = $data['first_name']  ?? $collector->first_name;
        $middleName = array_key_exists('middle_name', $data) ? $data['middle_name'] : $collector->middle_name;
        $lastName   = $data['last_name']   ?? $collector->last_name;

        if (isset($data['first_name']) || array_key_exists('middle_name', $data) || isset($data['last_name'])) {
            $data['name'] = implode(' ', array_filter([$firstName, $middleName, $lastName]));
        }

        $collector->update($data);
        AuditLog::record('UPDATE_COLLECTOR', $collector->code, "Updated collector {$collector->name}");

        return response()->json($collector);
    }

    public function approve(Collector $collector): JsonResponse
    {
        if ($collector->approval_status !== 'pending_approval') {
            return response()->json(['message' => 'Collector is not pending approval.'], 422);
        }

        $collector->update(['approval_status' => 'approved']);
        AuditLog::record('APPROVE_COLLECTOR', $collector->code, "Approved duplicate collector {$collector->name}");

        return response()->json($collector);
    }

    public function reject(Collector $collector): JsonResponse
    {
        if ($collector->approval_status !== 'pending_approval') {
            return response()->json(['message' => 'Collector is not pending approval.'], 422);
        }

        $code = $collector->code;
        $name = $collector->name;
        $collector->delete();

        AuditLog::record('REJECT_COLLECTOR', $code, "Rejected duplicate collector {$name}");

        return response()->json(['message' => 'Collector rejected and removed.']);
    }

    public function destroy(Collector $collector): JsonResponse
    {
        $collector->delete();
        AuditLog::record('DELETE_COLLECTOR', $collector->code, "Deleted collector {$collector->name}");
        return response()->json(['message' => 'Collector deleted.']);
    }
}
