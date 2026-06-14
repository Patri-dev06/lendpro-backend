<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name'            => 'required|string|max:255',
            'middle_name'           => 'nullable|string|max:255',
            'last_name'             => 'required|string|max:255',
            'email'                 => 'required|email|unique:users,email',
            'role'                  => 'required|in:admin,collector,manager,sysadmin,accounting_clerk',
            'password'              => ['required', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ], [
            'email.unique'          => 'This email is already in use. Please use a different one.',
            'first_name.required'   => 'First name is required.',
            'last_name.required'    => 'Last name is required.',
            'email.required'        => 'Email address is required.',
            'email.email'           => 'Please enter a valid email address.',
            'password.confirmed'    => 'Passwords do not match.',
        ]);

        foreach (['first_name', 'middle_name', 'last_name'] as $field) {
            if (!empty($data[$field])) $data[$field] = strtoupper($data[$field]);
        }

        $nameParts = array_filter([$data['first_name'], $data['middle_name'] ?? null, $data['last_name']]);
        $fullName  = implode(' ', $nameParts);

        $user = User::create([
            'name'        => $fullName,
            'first_name'  => $data['first_name'],
            'middle_name' => $data['middle_name'] ?? null,
            'last_name'   => $data['last_name'],
            'email'       => $data['email'],
            'role'        => $data['role'],
            'password'    => Hash::make($data['password']),
            'is_approved' => false,
        ]);

        AuditLog::record('REGISTER', "USR-{$user->id}", "User {$user->name} registered — pending approval", $user->id);

        Notification::notify(
            'user_pending',
            'New Registration Awaiting Approval',
            "{$user->name} has submitted a registration request as {$user->role}.",
            ['admin', 'sysadmin']
        );

        return response()->json([
            'message' => 'Registration submitted. An administrator will review and approve your account.',
            'pending' => true,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_approved) {
            return response()->json([
                'message' => 'Your account is pending administrator approval. Please try again later.',
            ], 403);
        }

        Auth::login($user);
        $request->session()->regenerate();

        AuditLog::record('LOGIN', "USR-{$user->id}", "User {$user->name} logged in", $user->id);

        return response()->json($this->userPayload($user));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ], [
            'password.confirmed' => 'New passwords do not match.',
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->update(['password' => Hash::make($request->password)]);

        // Regenerate session so any hijacked sessions are invalidated.
        $request->session()->regenerate();

        AuditLog::record('UPDATE', "USR-{$user->id}", "User {$user->name} changed their password", $user->id);

        return response()->json(['message' => 'Password changed successfully.']);
    }

    private function userPayload(User $user): array
    {
        return [
            'id'    => $user->id,
            'name'  => $user->name,
            'email' => $user->email,
            'role'  => $user->role,
        ];
    }
}
