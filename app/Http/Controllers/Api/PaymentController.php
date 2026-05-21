<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Loan;
use App\Models\Notification;
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
                ->whereIn('status', ['pending', 'partial'])
                ->first()
                ?? ScheduleRow::where('loan_id', $loan->id)
                    ->whereIn('status', ['pending', 'partial'])
                    ->orderBy('scheduled_date')
                    ->first();

            if ($scheduleRow) {
                $newActual = $scheduleRow->actual + $data['amount'];
                $scheduleRow->update([
                    'actual'        => $newActual,
                    'payment_date'  => $data['payment_date'],
                    'balance_after' => $newBalance,
                    'status'        => $newActual >= $scheduleRow->expected ? 'paid' : 'partial',
                ]);
            }

            AuditLog::record(
                'RECORD_PAYMENT',
                $loan->number,
                "Recorded ₱{$data['amount']} payment for loan {$loan->number}"
            );

            Notification::notify(
                'payment_recorded',
                'Payment Collected',
                "₱" . number_format($data['amount'], 2) . " collected from {$loan->client->name} ({$loan->number}). Remaining balance: ₱" . number_format($newBalance, 2) . ".",
                ['admin', 'manager', 'accounting_clerk', 'collector']
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
        $date        = $request->get('date', today()->toDateString());
        $collectorId = $request->get('collector_id');

        $loans = Loan::with([
            'client',
            'payments'     => fn ($q) => $q->whereDate('payment_date', $date),
            'scheduleRows' => fn ($q) => $q->whereDate('scheduled_date', '<', $date)
                                           ->whereIn('status', ['pending', 'partial']),
        ])
            ->where('status', '!=', 'paid')
            ->when($collectorId, fn ($q, $id) => $q->where('collector_id', $id))
            ->get();

        $rows = $loans->map(function ($l) {
            $carryOver   = $l->scheduleRows->sum(fn ($r) => $r->expected - $r->actual);
            $collectible = $l->daily_payment + $carryOver;

            return [
                'loan_number' => $l->number,
                'client_name' => $l->client->name,
                'daily'       => round($l->daily_payment, 2),
                'carry_over'  => round($carryOver, 2),
                'collectible' => round($collectible, 2),
                'balance'     => round($l->current_balance, 2),
                'payment'     => round($l->payments->sum('amount'), 2),
            ];
        });

        return response()->json([
            'date'   => $date,
            'rows'   => $rows,
            'totals' => [
                'collectible' => round($rows->sum('collectible'), 2),
                'balance'     => round($rows->sum('balance'), 2),
                'payment'     => round($rows->sum('payment'), 2),
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

    public function uploadCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:5120',
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');

        // Skip header row
        fgetcsv($handle);

        $valid  = [];
        $errors = [];
        $rowNum = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNum++;
            $row = array_map('trim', $row);

            if (count($row) < 3) {
                $errors[] = "Row {$rowNum}: expected at least 3 columns (loan_number, payment_date, amount).";
                continue;
            }

            [$loanNumber, $paymentDate, $rawAmount] = $row;
            $remarks = $row[3] ?? null;

            if (! $loanNumber || ! $paymentDate || ! is_numeric($rawAmount)) {
                $errors[] = "Row {$rowNum}: invalid data.";
                continue;
            }

            $loan = Loan::where('number', $loanNumber)->first();
            if (! $loan) {
                $errors[] = "Row {$rowNum}: loan '{$loanNumber}' not found.";
                continue;
            }

            $valid[] = [
                'loan'         => $loan,
                'payment_date' => $paymentDate,
                'amount'       => (float) $rawAmount,
                'remarks'      => $remarks,
            ];
        }

        fclose($handle);

        if (empty($valid)) {
            return response()->json(['errors' => $errors], 422);
        }

        $imported = DB::transaction(function () use ($valid) {
            $payments = [];

            foreach ($valid as $r) {
                $loan       = $r['loan'];
                $prev       = $loan->current_balance;
                $newBalance = max(0, $prev - $r['amount']);

                $payments[] = Payment::create([
                    'loan_id'          => $loan->id,
                    'client_id'        => $loan->client_id,
                    'collector_id'     => $loan->collector_id,
                    'recorded_by'      => auth()->id(),
                    'payment_date'     => $r['payment_date'],
                    'amount'           => $r['amount'],
                    'previous_balance' => $prev,
                    'new_balance'      => $newBalance,
                    'remarks'          => $r['remarks'],
                ]);

                $loan->update([
                    'current_balance' => $newBalance,
                    'status'          => $newBalance <= 0 ? 'paid' : $loan->status,
                ]);

                if ($newBalance <= 0) {
                    $loan->client->update(['status' => 'paid']);
                }

                $scheduleRow = ScheduleRow::where('loan_id', $loan->id)
                    ->whereDate('scheduled_date', $r['payment_date'])
                    ->whereIn('status', ['pending', 'partial'])
                    ->first()
                    ?? ScheduleRow::where('loan_id', $loan->id)
                        ->whereIn('status', ['pending', 'partial'])
                        ->orderBy('scheduled_date')
                        ->first();

                if ($scheduleRow) {
                    $newActual = $scheduleRow->actual + $r['amount'];
                    $scheduleRow->update([
                        'actual'        => $newActual,
                        'payment_date'  => $r['payment_date'],
                        'balance_after' => $newBalance,
                        'status'        => $newActual >= $scheduleRow->expected ? 'paid' : 'partial',
                    ]);
                }
            }

            AuditLog::record('BULK_PAYMENT_UPLOAD', 'BULK', 'Bulk uploaded ' . count($payments) . ' payments via CSV');

            return $payments;
        });

        return response()->json([
            'imported' => count($imported),
            'errors'   => $errors,
        ], 201);
    }
}
