<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'loan_id', 'client_id', 'collector_id', 'recorded_by',
        'payment_date', 'amount', 'previous_balance', 'new_balance', 'remarks',
        'delete_requested', 'delete_requested_by', 'delete_requested_at',
    ];

    protected $casts = [
        'amount'              => 'float',
        'previous_balance'    => 'float',
        'new_balance'         => 'float',
        'payment_date'        => 'date',
        'delete_requested'    => 'boolean',
        'delete_requested_at' => 'datetime',
    ];

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(Collector::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function deleteRequestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delete_requested_by');
    }
}
