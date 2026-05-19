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

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::select('id', 'name', 'email', 'role', 'is_approved', 'created_at')
            ->orderBy('is_approved')   // pending first
            ->orderBy('name')
            ->get();

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'role'     => 'required|in:admin,collector,manager,sysadmin,accounting_clerk',
            'password' => ['required', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ], [
            'email.unique'       => 'This email is already in use. Please use a different one.',
            'email.email'        => 'Please enter a valid email address.',
            'password.confirmed' => 'Passwords do not match.',
        ]);

        $user = User::create([
            'name'        => $data['name'],
            'email'       => $data['email'],
            'role'        => $data['role'],
            'password'    => Hash::make($data['password']),
            'is_approved' => true,
        ]);

        AuditLog::record('CREATE_USER', "USR-{$user->id}", "Created user {$user->name}");

        return response()->json($this->payload($user), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($this->payload($user));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => "sometimes|email|unique:users,email,{$user->id}",
            'role'     => 'sometimes|in:admin,collector,manager,sysadmin,accounting_clerk',
            'password' => ['sometimes', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        AuditLog::record('UPDATE_USER', "USR-{$user->id}", "Updated user {$user->name}");

        return response()->json($this->payload($user));
    }

    public function approve(User $user): JsonResponse
    {
        if ($user->is_approved) {
            return response()->json(['message' => 'User is already approved.'], 422);
        }

        $user->update(['is_approved' => true]);

        AuditLog::record('APPROVE_USER', "USR-{$user->id}", "Approved user {$user->name}");

        Notification::notify(
            'user_approved',
            'User Account Approved',
            "{$user->name}'s {$user->role} account has been approved and can now log in.",
            ['admin', 'sysadmin']
        );

        return response()->json($this->payload($user));
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'Cannot delete your own account.'], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        AuditLog::record('DELETE_USER', "USR-{$user->id}", "Deleted user {$user->name}");

        return response()->json(['message' => 'User deleted.']);
    }

    private function payload(User $user): array
    {
        return [
            'id'          => $user->id,
            'name'        => $user->name,
            'email'       => $user->email,
            'role'        => $user->role,
            'is_approved' => $user->is_approved,
            'created_at'  => $user->created_at,
        ];
    }
}
