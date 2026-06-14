<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        $settings = Setting::where('key', '!=', 'admin_pin')->orderBy('key')->get()->toArray();

        $settings[] = [
            'key'   => 'admin_pin_configured',
            'value' => Setting::get('admin_pin') ? '1' : '0',
        ];

        return response()->json($settings);
    }

    private const ALLOWED_KEYS = [
        'admin_pin',
        'default_service_charge',
        'default_loan_term',
        'loan_term_options',
        'holidays',
        'session_timeout_minutes',
        'company_name',
        'company_address',
        'company_phone',
        'company_email',
    ];

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'settings'         => 'required|array',
            'settings.*.key'   => ['required', 'string', 'max:100', 'in:' . implode(',', self::ALLOWED_KEYS)],
            'settings.*.value' => 'nullable|string',
        ]);

        foreach ($data['settings'] as $item) {
            if ($item['key'] === 'admin_pin_configured') continue;

            if ($item['key'] === 'admin_pin') {
                Setting::set('admin_pin', $item['value'] ? Hash::make($item['value']) : null);
                continue;
            }

            Setting::set($item['key'], $item['value'] ?? null);
        }

        AuditLog::record('UPDATE_SETTINGS', 'SETTINGS', 'Updated ' . count($data['settings']) . ' system settings');

        $settings = Setting::where('key', '!=', 'admin_pin')->orderBy('key')->get()->toArray();
        $settings[] = ['key' => 'admin_pin_configured', 'value' => Setting::get('admin_pin') ? '1' : '0'];

        return response()->json($settings);
    }

    public function verifyAdminPin(Request $request): JsonResponse
    {
        $pin = $request->input('pin', '');
        if (!$pin) {
            return response()->json(['message' => 'PIN is required.'], 422);
        }

        $storedHash = Setting::get('admin_pin');
        if (!$storedHash) {
            return response()->json(['message' => 'No admin PIN has been configured. Contact your administrator.'], 422);
        }

        if (!Hash::check($pin, $storedHash)) {
            return response()->json(['message' => 'Incorrect PIN.'], 403);
        }

        return response()->json(['valid' => true]);
    }
}
