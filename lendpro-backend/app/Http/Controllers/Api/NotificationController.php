<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user   = $request->user();
        $role   = $user->role;
        $readAt = $user->notifications_read_at;

        $notifications = Notification::whereJsonContains('for_roles', $role)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn ($n) => [
                'id'         => $n->id,
                'type'       => $n->type,
                'title'      => $n->title,
                'body'       => $n->body,
                'created_at' => $n->created_at,
                'is_read'    => $readAt && $n->created_at->lte($readAt),
            ]);

        $unread = $notifications->where('is_read', false)->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => $unread,
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $request->user()->update(['notifications_read_at' => now()]);

        return response()->json(['message' => 'Notifications marked as read.']);
    }
}
