<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Collector extends Model
{
    protected $fillable = [
        'name', 'code', 'area', 'approval_status',
        'phone', 'address', 'mothers_name', 'fathers_name',
        'place_of_birth', 'date_of_birth', 'fb_messenger',
        'email', 'drivers_license',
    ];

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function getStatsAttribute(): array
    {
        $loans = $this->loans()->with('client')->get();
        $activeLoans = $loans->where('status', '!=', 'paid');

        $expected = $activeLoans->sum('daily_payment');
        $actual = $this->payments()
            ->whereDate('payment_date', today())
            ->sum('amount');

        return [
            'assigned'  => $this->clients()->count(),
            'expected'  => (float) $expected,
            'actual'    => (float) $actual,
            'missed'    => $activeLoans->where('status', 'overdue')->count(),
            'overdue'   => $activeLoans->where('status', 'overdue')->count(),
            'past_due'  => $activeLoans->where('status', 'past-due')->count(),
        ];
    }
}
