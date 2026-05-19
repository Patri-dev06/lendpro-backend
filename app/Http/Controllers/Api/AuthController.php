<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name'                  => 'required|string|max:255',
            'email'                 => 'required|email|unique:users,email',
            'role'                  => 'required|in:admin,collector,manager,sysadmin,accounting_clerk',
            'password'              => ['required', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ], [
            'email.unique'          => 'This email is already in use. Please use a different one.',
            'name.required'         => 'Full name is required.',
            'email.required'        => 'Email address is required.',
            'email.email'           => 'Please enter a valid email address.',
            'password.confirmed'    => 'Passwords do not match.',
        ]);

        $user = User::create([
            'name'        => $request->name,
            'email'       => $request->email,
            'role'        => $request->role,
            'password'    => Hash::make($request->password),
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

        $token = $user->createToken('api-token')->plainTextToken;

        AuditLog::record('LOGIN', "USR-{$user->id}", "User {$user->name} logged in", $user->id);

        return response()->json([
            'user'  => $this->userPayload($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()));
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
