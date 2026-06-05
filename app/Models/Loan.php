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

        return sprintf('LN-%d-%04d', $year, $max + 1);
    }

    public static function computeDueDate(string $releaseDate, int $termDays, array $holidays = []): Carbon
    {
        // Due date = release date + termDays calendar days (holidays already folded into termDays via holiday_count)
        return Carbon::parse($releaseDate)->addDays($termDays);
    }

    public function generateSchedule(array $holidays = []): void
    {
        $holidaySet = array_flip($holidays);
        $this->scheduleRows()->delete();
        $date = Carbon::parse($this->release_date);
        $balance = $this->total_receivable;
        $rows = [];

        for ($i = 0; $i < $this->term_days; $i++) {
            do {
                $date->addDay();
            } while ($date->isSunday() || isset($holidaySet[$date->toDateString()]));

            $prev = $balance;
            $balance = max(0, $balance - $this->daily_payment);

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
