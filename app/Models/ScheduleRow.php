<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleRow extends Model
{
    protected $fillable = [
        'loan_id', 'scheduled_date', 'payment_date', 'expected', 'actual',
        'previous_balance', 'balance_after', 'status', 'remarks',
    ];

    protected $casts = [
        'expected'         => 'float',
        'actual'           => 'float',
        'previous_balance' => 'float',
        'balance_after'    => 'float',
        'scheduled_date'   => 'date',
        'payment_date'     => 'date',
    ];

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }
}
