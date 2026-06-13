<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id', 'action', 'record', 'description', 'ip_address', 'performed_at',
    ];

    protected $casts = [
        'performed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(string $action, string $record, string $description, ?int $userId = null): void
    {
        static::create([
            'user_id'      => $userId ?? auth()->id(),
            'action'       => $action,
            'record'       => $record,
            'description'  => $description,
            'ip_address'   => request()->ip(),
            'performed_at' => now(),
        ]);
    }
}
