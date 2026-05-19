<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user     = $request->user();
        $readAt   = $user->notifications_read_at;

        $logs = AuditLog::with('user:id,name')
            ->orderByDesc('performed_at')
            ->limit(30)
            ->get()
            ->map(fn ($log) => [
                'id'          => $log->id,
                'action'      => $log->action,
                'record'      => $log->record,
                'description' => $log->description,
                'performed_by'=> $log->user?->name,
                'performed_at'=> $log->performed_at,
                'is_read'     => $readAt && $log->performed_at->lte($readAt),
            ]);

        $unread = $logs->where('is_read', false)->count();

        return response()->json([
            'notifications' => $logs,
            'unread_count'  => $unread,
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $request->user()->update(['notifications_read_at' => now()]);

        return response()->json(['message' => 'Notifications marked as read.']);
    }
}
