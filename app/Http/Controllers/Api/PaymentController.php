<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\ScheduleRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with(['client', 'collector', 'recordedBy'])
            ->when($request->loan_id, fn ($q, $id) => $q->where('loan_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->collector_id, fn ($q, $id) => $q->where('collector_id', $id))
            ->when($request->date, fn ($q, $d) => $q->whereDate('payment_date', $d))
            ->orderByDesc('payment_date')
            ->get();

        return response()->json($payments);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'loan_id'      => 'required|exists:loans,id',
            'collector_id' => 'required|exists:collectors,id',
            'payment_date' => 'required|date',
            'amount'       => 'required|numeric|min:0.01',
            'remarks'      => 'nullable|string',
        ]);

        $loan = Loan::findOrFail($data['loan_id']);

        $payment = DB::transaction(function () use ($data, $loan) {
            $prev = $loan->current_balance;
            $newBalance = max(0, $prev - $data['amount']);

            $payment = Payment::create([
                'loan_id'          => $loan->id,
                'client_id'        => $loan->client_id,
                'collector_id'     => $data['collector_id'],
                'recorded_by'      => auth()->id(),
                'payment_date'     => $data['payment_date'],
                'amount'           => $data['amount'],
                'previous_balance' => $prev,
                'new_balance'      => $newBalance,
                'remarks'          => $data['remarks'] ?? null,
            ]);

            $loan->update([
                'current_balance' => $newBalance,
                'status'          => $newBalance <= 0 ? 'paid' : $loan->status,
            ]);

            if ($newBalance <= 0) {
                $loan->client->update(['status' => 'paid']);
            }

            $scheduleRow = ScheduleRow::where('loan_id', $loan->id)
                ->whereDate('scheduled_date', $data['payment_date'])
                ->first();

            if ($scheduleRow) {
                $scheduleRow->update([
                    'actual'       => $data['amount'],
                    'balance_after'=> $newBalance,
                    'status'       => $data['amount'] >= $scheduleRow->expected ? 'paid' : 'partial',
                ]);
            }

            AuditLog::record(
                'RECORD_PAYMENT',
                $loan->number,
                "Recorded ₱{$data['amount']} payment for loan {$loan->number}"
            );

            return $payment;
        });

        return response()->json($payment->load(['client', 'collector']), 201);
    }

    public function show(Payment $payment): JsonResponse
    {
        return response()->json($payment->load(['client', 'collector', 'recordedBy']));
    }

    public function collectorSummary(Request $request): JsonResponse
    {
        $date = $request->get('date', today()->toDateString());
        $collectorId = $request->get('collector_id');

        $loans = Loan::with(['client', 'payments' => fn ($q) => $q->whereDate('payment_date', $date)])
            ->where('status', '!=', 'paid')
            ->when($collectorId, fn ($q, $id) => $q->where('collector_id', $id))
            ->get();

        $rows = $loans->map(fn ($l) => [
            'loan_number'  => $l->number,
            'client_name'  => $l->client->name,
            'collectible'  => $l->daily_payment,
            'balance'      => $l->current_balance,
            'payment'      => $l->payments->sum('amount'),
        ]);

        return response()->json([
            'date'  => $date,
            'rows'  => $rows,
            'totals'=> [
                'collectible' => $rows->sum('collectible'),
                'balance'     => $rows->sum('balance'),
                'payment'     => $rows->sum('payment'),
            ],
        ]);
    }

    public function update(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate(['remarks' => 'nullable|string']);
        $payment->update($data);
        return response()->json($payment);
    }

    public function destroy(Payment $payment): JsonResponse
    {
        $payment->delete();
        return response()->json(['message' => 'Payment deleted.']);
    }
}
