<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Loan;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\ScheduleRow;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with(['client', 'collector', 'recordedBy', 'loan:id,release_date', 'deleteRequestedBy:id,first_name,last_name'])
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
            'payment_date' => 'required|date',
            'amount'       => 'required|numeric|min:0.01',
            'remarks'      => 'nullable|string',
        ]);

        $loan = Loan::findOrFail($data['loan_id']);

        if ($data['payment_date'] < $loan->release_date) {
            return response()->json([
                'message' => "Payment date cannot be before the loan's release date ({$loan->release_date}).",
            ], 422);
        }

        $payment = DB::transaction(function () use ($data, $loan) {
            $prev = $loan->current_balance;
            $newBalance = max(0, $prev - $data['amount']);

            $payment = Payment::create([
                'loan_id'          => $loan->id,
                'client_id'        => $loan->client_id,
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
                $loan->client->update(['status' => 'paid', 'type' => 'renew']);
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
        // Support both single-date (?date=) and range (?from_date=&to_date=)
        $today       = today()->toDateString();
        $fromDate    = $request->get('from_date', $request->get('date', $today));
        $toDate      = $request->get('to_date', $fromDate);
        $collectorId = $request->get('collector_id');

        $loans = Loan::with([
            'client',
            'payments'     => fn ($q) => $q->whereBetween('payment_date', [$fromDate, $toDate]),
            'scheduleRows' => fn ($q) => $q->whereDate('scheduled_date', '<', $fromDate)
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
            'from_date' => $fromDate,
            'to_date'   => $toDate,
            'rows'      => $rows,
            'totals'    => [
                'collectible' => round($rows->sum('collectible'), 2),
                'balance'     => round($rows->sum('balance'), 2),
                'payment'     => round($rows->sum('payment'), 2),
            ],
        ]);
    }

    private function isAdminPinValid(?string $pin): bool
    {
        if (!$pin) return false;
        $hash = Setting::get('admin_pin');
        if (!$hash) return false;
        return Hash::check($pin, $hash);
    }

    public function update(Request $request, Payment $payment): JsonResponse
    {
        $user = auth()->user();
        if (!in_array($user->role, ['admin', 'accounting_clerk'])) {
            if (!$this->isAdminPinValid($request->input('admin_pin'))) {
                return response()->json(['message' => 'Admin PIN required to edit this payment.'], 403);
            }
        }

        $data = $request->validate([
            'amount'       => 'sometimes|numeric|min:0.01',
            'payment_date' => 'sometimes|date',
            'remarks'      => 'nullable|string',
        ]);

        if (isset($data['payment_date'])) {
            $loan = Loan::findOrFail($payment->loan_id);
            if ($data['payment_date'] < $loan->release_date) {
                return response()->json([
                    'message' => "Payment date cannot be before the loan's release date ({$loan->release_date}).",
                ], 422);
            }
        }

        DB::transaction(function () use ($data, $payment) {
            if (isset($data['amount']) && (float) $data['amount'] !== (float) $payment->amount) {
                $loan    = Loan::findOrFail($payment->loan_id);
                $oldAmt  = (float) $payment->amount;
                $newAmt  = (float) $data['amount'];
                $diff    = $newAmt - $oldAmt;

                $newLoanBalance    = max(0, $loan->current_balance - $diff);
                $newPaymentBalance = max(0, $payment->previous_balance - $newAmt);

                $loan->update([
                    'current_balance' => $newLoanBalance,
                    'status'          => $newLoanBalance <= 0 ? 'paid' : $loan->status,
                ]);

                if ($newLoanBalance <= 0) {
                    $loan->client->update(['status' => 'paid', 'type' => 'renew']);
                }

                $payment->update([
                    'amount'      => $newAmt,
                    'new_balance' => $newPaymentBalance,
                ]);

                AuditLog::record(
                    'UPDATE_PAYMENT',
                    $loan->number,
                    "Payment #{$payment->id} amount edited: ₱{$oldAmt} → ₱{$newAmt}"
                );
            }

            $updateFields = array_filter([
                'payment_date' => $data['payment_date'] ?? null,
                'remarks'      => $data['remarks'] ?? $payment->remarks,
            ], fn ($v) => $v !== null);

            if ($updateFields) {
                $payment->update($updateFields);
            }
        });

        return response()->json($payment->fresh(['client', 'recordedBy']));
    }

    public function requestDelete(Payment $payment): JsonResponse
    {
        if ($payment->delete_requested) {
            return response()->json(['message' => 'Deletion already requested.'], 422);
        }

        $payment->update([
            'delete_requested'    => true,
            'delete_requested_by' => auth()->id(),
            'delete_requested_at' => now(),
        ]);

        $user = auth()->user();
        AuditLog::record(
            'REQUEST_DELETE_PAYMENT',
            "Payment #{$payment->id}",
            "User {$user->first_name} {$user->last_name} requested deletion of payment #{$payment->id} (₱{$payment->amount}) for loan ID {$payment->loan_id}"
        );

        return response()->json($payment->fresh(['client', 'deleteRequestedBy:id,first_name,last_name']));
    }

    public function cancelDeleteRequest(Payment $payment): JsonResponse
    {
        $user = auth()->user();
        $isAdmin = $user->role === 'admin';

        if (! $isAdmin && $payment->delete_requested_by !== $user->id) {
            return response()->json(['message' => 'You can only cancel your own deletion requests.'], 403);
        }

        $payment->update([
            'delete_requested'    => false,
            'delete_requested_by' => null,
            'delete_requested_at' => null,
        ]);

        return response()->json($payment->fresh(['client']));
    }

    public function destroy(Request $request, Payment $payment): JsonResponse
    {
        if (auth()->user()->role !== 'admin') {
            if (!$this->isAdminPinValid($request->input('admin_pin'))) {
                return response()->json(['message' => 'Only administrators can delete payments. Provide the admin PIN to override.'], 403);
            }
        }

        DB::transaction(function () use ($payment) {
            $loan   = Loan::with('client')->findOrFail($payment->loan_id);
            $amount = (float) $payment->amount;

            $wasPayd   = $loan->status === 'paid';
            $newBalance = $loan->current_balance + $amount;

            $loan->update([
                'current_balance' => $newBalance,
                'status'          => $wasPayd ? 'active' : $loan->status,
            ]);

            if ($wasPayd) {
                $loan->client->update(['status' => 'active']);
            }

            // Reset the matching schedule row
            $scheduleRow = ScheduleRow::where('loan_id', $loan->id)
                ->whereDate('payment_date', $payment->payment_date)
                ->orderBy('scheduled_date')
                ->first();

            if ($scheduleRow) {
                $newActual = max(0, (float) $scheduleRow->actual - $amount);
                $scheduleRow->update([
                    'actual'        => $newActual,
                    'payment_date'  => $newActual > 0 ? $scheduleRow->payment_date : null,
                    'balance_after' => $newBalance,
                    'status'        => $newActual <= 0 ? 'pending' : 'partial',
                ]);
            }

            AuditLog::record(
                'DELETE_PAYMENT',
                $loan->number,
                "Admin deleted payment #{$payment->id}: ₱{$amount} for loan {$loan->number}. Balance restored to ₱{$newBalance}."
            );

            $payment->delete();
        });

        return response()->json(['message' => 'Payment deleted and loan balance restored.']);
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

            if ($paymentDate < $loan->release_date) {
                $errors[] = "Row {$rowNum}: payment date cannot be before the loan's release date ({$loan->release_date}).";
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
                    $loan->client->update(['status' => 'paid', 'type' => 'renew']);
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
