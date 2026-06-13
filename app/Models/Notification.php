<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = ['type', 'title', 'body', 'for_roles'];

    protected $casts = ['for_roles' => 'array'];

    public static function notify(string $type, string $title, string $body, array $roles): self
    {
        return self::create([
            'type'      => $type,
            'title'     => $title,
            'body'      => $body,
            'for_roles' => $roles,
        ]);
    }
}
