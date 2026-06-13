<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Loan;
use App\Models\LoanPenalty;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ProcessLoanStatuses extends Command
{
    protected $signature   = 'loans:process-statuses';
    protected $description = 'Mark overdue/past-due loans and apply monthly compound penalties';

    private const INTEREST_RATE = 5.0; // % applied monthly on remaining balance
    private const PENALTY_RATE  = 3.0; // % applied monthly on remaining balance
    private const PAST_DUE_DAYS = 6;   // days after overdue before past-due kicks in
    private const PENALTY_CYCLE = 30;  // days between compound applications

    public function handle(): int
    {
        $today = Carbon::today();

        $this->markOverdue($today);
        $this->markPastDue($today);
        $this->applyCompoundPenalties($today);

        return self::SUCCESS;
    }

    private function markOverdue(Carbon $today): void
    {
        $loans = Loan::whereIn('status', ['new', 'renew'])
            ->whereDate('due_date', '<', $today)
            ->whereNull('overdue_since')
            ->get();

        foreach ($loans as $loan) {
            $loan->update([
                'status'       => 'overdue',
                'overdue_since' => $today->toDateString(),
            ]);
            AuditLog::record('FLAG_OVERDUE', $loan->number, "Loan {$loan->number} marked overdue — due date was {$loan->due_date->toDateString()}");
        }

        if ($loans->count()) {
            $this->info("Marked {$loans->count()} loan(s) as overdue.");
        }
    }

    private function markPastDue(Carbon $today): void
    {
        $cutoff = $today->copy()->subDays(self::PAST_DUE_DAYS);

        $loans = Loan::where('status', 'overdue')
            ->whereDate('overdue_since', '<=', $cutoff)
            ->get();

        foreach ($loans as $loan) {
            $loan->update([
                'status'         => 'past-due',
                'past_due_since' => $today->toDateString(),
            ]);

            AuditLog::record('FLAG_PAST_DUE', $loan->number, "Loan {$loan->number} marked past-due");

            // First penalty applied immediately on transition
            $this->applyPenalty($loan, $today);
        }

        if ($loans->count()) {
            $this->info("Marked {$loans->count()} loan(s) as past-due with initial penalty applied.");
        }
    }

    private function applyCompoundPenalties(Carbon $today): void
    {
        $cutoff = $today->copy()->subDays(self::PENALTY_CYCLE);

        // Only loans that already had their first penalty (last_penalty_at is set)
        $loans = Loan::where('status', 'past-due')
            ->whereNotNull('last_penalty_at')
            ->whereDate('last_penalty_at', '<=', $cutoff)
            ->get();

        foreach ($loans as $loan) {
            $this->applyPenalty($loan, $today);
        }

        if ($loans->count()) {
            $this->info("Applied compound penalty to {$loans->count()} past-due loan(s).");
        }
    }

    private function applyPenalty(Loan $loan, Carbon $today): void
    {
        if ($loan->current_balance <= 0) {
            return;
        }

        $balanceBefore  = $loan->current_balance;
        $interestAmount = round($balanceBefore * self::INTEREST_RATE / 100, 2);
        $penaltyAmount  = round($balanceBefore * self::PENALTY_RATE / 100, 2);
        $totalAdded     = $interestAmount + $penaltyAmount;
        $balanceAfter   = round($balanceBefore + $totalAdded, 2);

        $loan->update([
            'current_balance' => $balanceAfter,
            'last_penalty_at' => $today->toDateString(),
        ]);

        LoanPenalty::create([
            'loan_id'         => $loan->id,
            'applied_at'      => $today->toDateString(),
            'balance_before'  => $balanceBefore,
            'interest_rate'   => self::INTEREST_RATE,
            'penalty_rate'    => self::PENALTY_RATE,
            'interest_amount' => $interestAmount,
            'penalty_amount'  => $penaltyAmount,
            'total_added'     => $totalAdded,
            'balance_after'   => $balanceAfter,
        ]);

        AuditLog::record(
            'APPLY_PENALTY',
            $loan->number,
            "Compound penalty applied to {$loan->number}: ₱{$totalAdded} added (₱{$balanceBefore} → ₱{$balanceAfter})"
        );
    }
}
