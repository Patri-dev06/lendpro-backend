<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Loan extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'number', 'client_id', 'collector_id', 'loan_type',
        'principal', 'interest', 'service_charge', 'total_receivable',
        'daily_payment', 'term_days', 'current_balance',
        'release_date', 'due_date', 'expected_end_date',
        'status', 'remarks',
    ];

    protected $casts = [
        'principal'       => 'float',
        'interest'        => 'float',
        'service_charge'  => 'float',
        'total_receivable'=> 'float',
        'daily_payment'   => 'float',
        'current_balance' => 'float',
        'term_days'       => 'integer',
        'release_date'    => 'date',
        'due_date'        => 'date',
        'expected_end_date' => 'date',
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

    public static function generateNumber(): string
    {
        $year = now()->year;
        $last = static::whereYear('created_at', $year)->count();
        return sprintf('LN-%d-%04d', $year, $last + 1);
    }

    public static function computeDueDate(string $releaseDate, int $termDays, array $holidays = []): Carbon
    {
        $holidaySet = array_flip($holidays);
        $date = Carbon::parse($releaseDate);
        $added = 0;
        while ($added < $termDays) {
            $date->addDay();
            if ($date->dayOfWeek !== Carbon::SUNDAY && !isset($holidaySet[$date->toDateString()])) {
                $added++;
            }
        }
        return $date;
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
            } while ($date->dayOfWeek === Carbon::SUNDAY || isset($holidaySet[$date->toDateString()]));

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
