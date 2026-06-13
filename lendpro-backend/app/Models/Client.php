<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'number', 'name', 'first_name', 'middle_name', 'last_name',
        'store_name', 'address', 'phone', 'email',
        'type', 'collector_id', 'status', 'approval_status',
        'latitude', 'longitude',
    ];

    protected $casts = [
        'type'      => 'string',
        'status'    => 'string',
        'latitude'  => 'float',
        'longitude' => 'float',
    ];

    public function collector(): BelongsTo
    {
        return $this->belongsTo(Collector::class);
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function activeLoan(): HasMany
    {
        return $this->hasMany(Loan::class)->whereNotIn('status', ['paid'])->latest();
    }
}
