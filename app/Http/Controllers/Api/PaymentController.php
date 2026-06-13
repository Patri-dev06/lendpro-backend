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
            ->when($request->from_date, fn ($q, $d) => $q->whereDate('payment_date', '>=', $d))
            ->when($request->to_date, fn ($q, $d) => $q->whereDate('payment_date', '<=', $d))
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

            // Re-derive the running ledger (per-payment prev/new, loan balance/status,
            // and the daily schedule_rows) chronologically, so out-of-order entries
            // stay consistent across the Direct Input and Client Ledger views.
            $loan->recalculatePaymentLedger();
            $newBalance = (float) $loan->current_balance;

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

        return response()->json($payment->fresh(['client', 'collector']), 201);
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
            $loan   = Loan::findOrFail($payment->loan_id);
            $oldAmt = (float) $payment->amount;

            $fields = [];
            if (isset($data['amount']))             $fields['amount']       = $data['amount'];
            if (isset($data['payment_date']))       $fields['payment_date'] = $data['payment_date'];
            if (array_key_exists('remarks', $data)) $fields['remarks']      = $data['remarks'];
            if ($fields) {
                $payment->update($fields);
            }

            // Re-derive the whole ledger — handles amount changes and date re-ordering.
            $loan->recalculatePaymentLedger();

            if (isset($data['amount']) && (float) $data['amount'] !== $oldAmt) {
                AuditLog::record(
                    'UPDATE_PAYMENT',
                    $loan->number,
                    "Payment #{$payment->id} amount edited: ₱{$oldAmt} → ₱{$data['amount']}"
                );
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

            $payment->delete();

            // Rebuild the ledger (balance/status + daily schedule) without this payment.
            $loan->recalculatePaymentLedger();
            $newBalance = (float) $loan->current_balance;

            AuditLog::record(
                'DELETE_PAYMENT',
                $loan->number,
                "Admin deleted payment #{$payment->id}: ₱{$amount} for loan {$loan->number}. Balance restored to ₱{$newBalance}."
            );
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

            // Format: loan_number, payment_date, client_name, daily_payment, amount_paid, remarks
            if (count($row) < 5) {
                $errors[] = "Row {$rowNum}: expected columns — loan_number, payment_date, client_name, daily_payment, amount_paid, remarks.";
                continue;
            }

            $loanNumber  = $row[0];
            $paymentDate = $row[1];
            // col[2] = client_name (reference, ignored)
            // col[3] = daily_payment (reference, ignored)
            $rawAmount   = $row[4];
            $remarks     = $row[5] ?? null;

            if (! $loanNumber || ! $paymentDate || ! is_numeric($rawAmount) || (float) $rawAmount <= 0) {
                $errors[] = "Row {$rowNum}: invalid data — amount_paid must be a number greater than 0.";
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
                // Loan balance/status, client status, and schedule_rows are all
                // normalized by the per-loan recalculatePaymentLedger() after the batch.
            }

            // Normalize each affected loan's ledger once the whole batch is in.
            collect($valid)->pluck('loan')->unique('id')
                ->each(fn (Loan $loan) => $loan->recalculatePaymentLedger());

            AuditLog::record('BULK_PAYMENT_UPLOAD', 'BULK', 'Bulk uploaded ' . count($payments) . ' payments via CSV');

            return $payments;
        });

        return response()->json([
            'imported' => count($imported),
            'errors'   => $errors,
        ], 201);
    }
}
