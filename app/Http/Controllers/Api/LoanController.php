<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\Loan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $loans = Loan::with(['client', 'collector'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->collector_id, fn ($q, $id) => $q->where('collector_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->latest()
            ->get();

        return response()->json($loans);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id'    => 'required|exists:clients,id',
            'collector_id' => 'required|exists:collectors,id',
            'loan_type'    => 'required|in:new-loan,reloan,reconstruct',
            'principal'    => 'required|numeric|min:1',
            'interest'     => 'required|numeric|min:0',
            'service_charge' => 'required|numeric|min:0',
            'daily_payment'  => 'required|numeric|min:1',
            'term_days'    => 'required|integer|in:30,45,60',
            'release_date' => 'required|date',
            'remarks'      => 'nullable|string',
        ]);

        $data['total_receivable'] = $data['principal'] + $data['interest'] + $data['service_charge'];
        $data['current_balance']  = $data['total_receivable'];
        $data['due_date']         = Loan::computeDueDate($data['release_date'], $data['term_days'])->toDateString();
        $data['expected_end_date'] = $data['due_date'];
        $data['number']           = Loan::generateNumber();
        $data['status']           = Client::find($data['client_id'])->type;

        $loan = DB::transaction(function () use ($data) {
            $loan = Loan::create($data);
            $loan->generateSchedule();

            Client::find($data['client_id'])->update(['status' => $data['status']]);

            AuditLog::record('CREATE_LOAN', $loan->number, "Created {$data['loan_type']} for client #{$data['client_id']}");

            return $loan;
        });

        return response()->json($loan->load(['client', 'collector', 'scheduleRows']), 201);
    }

    public function show(Loan $loan): JsonResponse
    {
        return response()->json($loan->load(['client', 'collector', 'scheduleRows', 'payments.collector']));
    }

    public function schedule(Loan $loan): JsonResponse
    {
        return response()->json($loan->scheduleRows()->orderBy('scheduled_date')->get());
    }

    public function update(Request $request, Loan $loan): JsonResponse
    {
        $data = $request->validate([
            'status'          => 'sometimes|in:new,renew,overdue,past-due,paid',
            'current_balance' => 'sometimes|numeric|min:0',
            'collector_id'    => 'sometimes|exists:collectors,id',
            'remarks'         => 'nullable|string',
        ]);

        $loan->update($data);

        AuditLog::record('UPDATE_LOAN', $loan->number, "Updated loan {$loan->number}");

        return response()->json($loan->load(['client', 'collector']));
    }

    public function destroy(Loan $loan): JsonResponse
    {
        $loan->delete();
        AuditLog::record('DELETE_LOAN', $loan->number, "Deleted loan {$loan->number}");
        return response()->json(['message' => 'Loan deleted.']);
    }

    public function regenerateSchedule(Loan $loan): JsonResponse
    {
        if ($loan->status === 'paid') {
            return response()->json(['message' => 'Cannot regenerate schedule for a fully paid loan.'], 422);
        }

        DB::transaction(function () use ($loan) {
            $loan->generateSchedule();
            AuditLog::record('REGENERATE_SCHEDULE', $loan->number, "Regenerated collection schedule for loan {$loan->number}");
        });

        return response()->json($loan->scheduleRows()->orderBy('scheduled_date')->get());
    }
}
