<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanPenalty extends Model
{
    protected $fillable = [
        'loan_id',
        'applied_at',
        'balance_before',
        'interest_rate',
        'penalty_rate',
        'interest_amount',
        'penalty_amount',
        'total_added',
        'balance_after',
    ];

    protected $casts = [
        'applied_at'      => 'date',
        'balance_before'  => 'float',
        'interest_rate'   => 'float',
        'penalty_rate'    => 'float',
        'interest_amount' => 'float',
        'penalty_amount'  => 'float',
        'total_added'     => 'float',
        'balance_after'   => 'float',
    ];

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }
}
