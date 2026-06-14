<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\LoanPenalty;
use Illuminate\Database\Eloquent\SoftDeletes;

class Loan extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'number', 'client_id', 'collector_id', 'loan_type',
        'principal', 'interest', 'service_charge', 'total_receivable',
        'daily_payment', 'term_days', 'holiday_count', 'current_balance',
        'release_date', 'due_date', 'expected_end_date',
        'status', 'remarks',
        'overdue_since', 'past_due_since', 'last_penalty_at',
    ];

    protected $casts = [
        'principal'        => 'float',
        'interest'         => 'float',
        'service_charge'   => 'float',
        'total_receivable' => 'float',
        'daily_payment'    => 'float',
        'current_balance'  => 'float',
        'term_days'        => 'integer',
        'holiday_count'    => 'integer',
        'release_date'     => 'date',
        'due_date'         => 'date',
        'expected_end_date'=> 'date',
        'overdue_since'    => 'date',
        'past_due_since'   => 'date',
        'last_penalty_at'  => 'date',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(Collector::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Rebuilds previous_balance / new_balance for every balance-affecting payment
     * in chronological order (date, then insertion order), starting from
     * total_receivable, and syncs the loan's current_balance and status.
     *
     * Fee rows such as the Processing Fee are created with NULL balances and are
     * skipped — they don't reduce the loan balance and are left untouched.
     */
    public function recalculatePaymentLedger(): void
    {
        $payments = $this->payments()
            ->orderBy('payment_date')
            ->orderBy('id')
            ->get();

        $running = (float) $this->total_receivable;

        foreach ($payments as $payment) {
            // NULL balances mark a non-ledger fee row (e.g. Processing Fee).
            if (is_null($payment->previous_balance) && is_null($payment->new_balance)) {
                continue;
            }

            $prev    = $running;
            $running = max(0, round($prev - (float) $payment->amount, 2));

            if ((float) $payment->previous_balance !== $prev || (float) $payment->new_balance !== $running) {
                $payment->update(['previous_balance' => $prev, 'new_balance' => $running]);
            }
        }

        $wasPaid = $this->status === 'paid';
        $isPaid  = $running <= 0;

        // A loan that is no longer fully paid reverts to the client's loan type
        // (new/renew) — the same status release assigns. "active" is not a valid
        // loans/clients status per the DB check constraints.
        $restored = in_array($this->client?->type, ['new', 'renew'], true) ? $this->client->type : 'new';

        $this->update([
            'current_balance' => $running,
            'status'          => $isPaid ? 'paid' : ($wasPaid ? $restored : $this->status),
        ]);

        if ($this->client) {
            if ($isPaid) {
                $this->client->update(['status' => 'paid', 'type' => 'renew']);
            } elseif ($wasPaid) {
                $this->client->update(['status' => $restored]);
            }
        }

        $this->rebuildScheduleFromPayments($payments);
    }

    /**
     * Rebuilds the daily schedule_rows (actual / payment_date / balances / status)
     * from the payments, so the Client Ledger and print stay consistent with the
     * payment history. Each payment is credited to the most recent collection day
     * on or before its date ("roll to that day's collection"). The fixed plan
     * (scheduled_date / expected) is preserved.
     */
    private function rebuildScheduleFromPayments($payments): void
    {
        $rows = $this->scheduleRows()->orderBy('scheduled_date')->get();
        if ($rows->isEmpty()) {
            return;
        }

        $rowDate = fn ($r) => Carbon::parse($r->scheduled_date)->toDateString();
        $applied = [];
        foreach ($rows as $row) {
            $applied[$row->id] = ['actual' => 0.0, 'date' => null];
        }

        foreach ($payments as $payment) {
            // Skip non-ledger fee rows (NULL balances), same as the balance pass.
            if (is_null($payment->previous_balance) && is_null($payment->new_balance)) {
                continue;
            }
            $pdate  = Carbon::parse($payment->payment_date)->toDateString();
            $target = $rows->last(fn ($r) => $rowDate($r) <= $pdate) ?? $rows->first();
            $applied[$target->id]['actual'] += (float) $payment->amount;
            $applied[$target->id]['date']    = $pdate; // payments are ordered asc → latest wins
        }

        $running = (float) $this->total_receivable;
        foreach ($rows as $row) {
            $actual  = round($applied[$row->id]['actual'], 2);
            $prev    = $running;
            $running = max(0, round($prev - $actual, 2));
            $status  = $actual <= 0
                ? 'pending'
                : ($actual >= (float) $row->expected ? 'paid' : 'partial');

            $row->update([
                'actual'           => $actual,
                'payment_date'     => $applied[$row->id]['date'],
                'previous_balance' => $prev,
                'balance_after'    => $running,
                'status'           => $status,
            ]);
        }
    }

    public function scheduleRows(): HasMany
    {
        return $this->hasMany(ScheduleRow::class)->orderBy('scheduled_date');
    }

    public function penalties(): HasMany
    {
        return $this->hasMany(LoanPenalty::class)->orderBy('applied_at');
    }

    public static function generateNumber(): string
    {
        $year = now()->year;
        $prefix = "LN-{$year}-";

        $max = static::withTrashed()
            ->where('number', 'like', $prefix . '%')
            ->pluck('number')
            ->map(fn($n) => (int) substr($n, strlen($prefix)))
            ->max() ?? 0;

        return sprintf('LN-%d-%012d', $year, $max + 1);
    }

    public static function computeDueDate(string $releaseDate, int $termDays, array $holidays = []): Carbon
    {
        // Due date = release date + termDays calendar days (holidays already folded into termDays via holiday_count)
        return Carbon::parse($releaseDate)->addDays($termDays);
    }

    public function generateSchedule(array $holidays = []): void
    {
        $this->scheduleRows()->delete();
        $date    = Carbon::parse($this->release_date);
        $balance = $this->total_receivable;
        $rows    = [];

        for ($i = 0; $i < $this->term_days; $i++) {
            $date->addDay();

            $prev    = $balance;
            $balance = max(0, round($prev - $this->daily_payment, 2));

            $rows[] = [
                'loan_id'          => $this->id,
                'scheduled_date'   => $date->toDateString(),
                'expected'         => $this->daily_payment,
                'actual'           => 0,
                'previous_balance' => $prev,
                'balance_after'    => $balance,
                'status'           => 'pending',
                'created_at'       => now(),
                'updated_at'       => now(),
            ];
        }

        ScheduleRow::insert($rows);
    }
}
