<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\Loan;
use App\Models\Notification;
use App\Models\Setting;
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
            'client_id'     => 'required|exists:clients,id',
            'loan_type'     => 'required|in:new-loan,reloan,reconstruct',
            'principal'     => 'required|numeric|min:1',
            'interest'      => 'required|numeric|min:0',
            'service_charge'=> 'required|numeric|min:0',
            'daily_payment' => 'required|numeric|min:1',
            'term_days'     => 'required|integer|min:1',
            'holiday_count' => 'sometimes|integer|min:0|max:5',
            'release_date'  => 'required|date',
            'remarks'       => 'nullable|string',
        ]);

        $data['holiday_count'] = $data['holiday_count'] ?? 0;

        $client = Client::findOrFail($data['client_id']);
        $data['collector_id'] = $client->collector_id;

        $holidays = array_column(json_decode(Setting::get('holidays', '[]'), true) ?? [], 'date');

        $data['total_receivable'] = $data['principal'] + $data['interest']; // processing fee deducted from release, not added to balance
        $data['current_balance']  = $data['total_receivable'];
        $data['due_date']         = Loan::computeDueDate($data['release_date'], $data['term_days'] + $data['holiday_count'], $holidays)->toDateString();
        $data['expected_end_date'] = $data['due_date'];
        $data['number']           = Loan::generateNumber();
        $data['status']           = 'pending';

        $loan = DB::transaction(function () use ($data, $holidays) {
            $loan = Loan::create($data);
            $loan->generateSchedule($holidays);
            AuditLog::record('CREATE_LOAN', $loan->number, "Created {$data['loan_type']} for client #{$data['client_id']} (pending release)");
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
            'status'          => 'sometimes|in:new,renew,overdue,past-due,paid,pending',
            'current_balance' => 'sometimes|numeric|min:0',
            'collector_id'    => 'sometimes|exists:collectors,id',
            'remarks'         => 'nullable|string',
        ]);

        $loan->update($data);

        AuditLog::record('UPDATE_LOAN', $loan->number, "Updated loan {$loan->number}");

        return response()->json($loan->load(['client', 'collector']));
    }

    public function release(Loan $loan): JsonResponse
    {
        if ($loan->status !== 'pending') {
            return response()->json(['message' => 'Only pending loans can be released.'], 422);
        }

        $client    = $loan->client;
        $newStatus = $client->type;

        DB::transaction(function () use ($loan, $client, $newStatus) {
            $loan->update(['status' => $newStatus]);
            $client->update(['status' => $newStatus]);

            AuditLog::record('RELEASE_LOAN', $loan->number, "Released loan {$loan->number} to {$client->name}");

            $loanTypeLabel = ucfirst(str_replace('-', ' ', $loan->loan_type));
            Notification::notify(
                'loan_released',
                'New Loan Released',
                "{$loanTypeLabel} of ₱" . number_format($loan->principal, 2) . " released to {$client->name} ({$loan->number}).",
                ['admin', 'manager', 'accounting_clerk']
            );
        });

        return response()->json($loan->fresh()->load(['client', 'collector', 'scheduleRows']));
    }

    public function reschedule(Request $request, Loan $loan): JsonResponse
    {
        if ($loan->status !== 'pending') {
            return response()->json(['message' => 'Only pending loans can be rescheduled.'], 422);
        }

        $data = $request->validate([
            'release_date' => 'required|date',
        ]);

        $holidays   = array_column(json_decode(Setting::get('holidays', '[]'), true) ?? [], 'date');
        $newDueDate = Loan::computeDueDate($data['release_date'], $loan->term_days + $loan->holiday_count, $holidays)->toDateString();

        DB::transaction(function () use ($loan, $data, $newDueDate, $holidays) {
            $loan->update([
                'release_date'      => $data['release_date'],
                'due_date'          => $newDueDate,
                'expected_end_date' => $newDueDate,
            ]);
            $loan->generateSchedule($holidays);
            AuditLog::record('RESCHEDULE_LOAN', $loan->number, "Rescheduled loan {$loan->number} release to {$data['release_date']}");
        });

        return response()->json($loan->fresh()->load(['client', 'collector', 'scheduleRows']));
    }

    public function cancel(Loan $loan): JsonResponse
    {
        if ($loan->status !== 'pending') {
            return response()->json(['message' => 'Only pending loans can be cancelled.'], 422);
        }

        $loanNumber = $loan->number;
        DB::transaction(function () use ($loan, $loanNumber) {
            $loan->scheduleRows()->delete();
            $loan->delete();
            AuditLog::record('CANCEL_LOAN', $loanNumber, "Cancelled and deleted pending loan {$loanNumber}");
        });

        return response()->json(['message' => 'Loan cancelled and deleted.']);
    }

    public function destroy(Loan $loan): JsonResponse
    {
        $loan->delete();
        AuditLog::record('DELETE_LOAN', $loan->number, "Deleted loan {$loan->number}");
        return response()->json(['message' => 'Loan deleted.']);
    }

    public function penalties(Loan $loan): JsonResponse
    {
        return response()->json($loan->penalties()->get());
    }

    public function regenerateSchedule(Loan $loan): JsonResponse
    {
        if ($loan->status === 'paid') {
            return response()->json(['message' => 'Cannot regenerate schedule for a fully paid loan.'], 422);
        }

        $holidays = array_column(json_decode(Setting::get('holidays', '[]'), true) ?? [], 'date');

        DB::transaction(function () use ($loan, $holidays) {
            $loan->generateSchedule($holidays);
            AuditLog::record('REGENERATE_SCHEDULE', $loan->number, "Regenerated collection schedule for loan {$loan->number}");
        });

        return response()->json($loan->scheduleRows()->orderBy('scheduled_date')->get());
    }
}
