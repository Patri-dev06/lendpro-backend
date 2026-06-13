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
        $users = User::select('id', 'name', 'first_name', 'middle_name', 'last_name', 'contact_name', 'address', 'email', 'role', 'is_approved', 'created_at')
            ->orderBy('is_approved')
            ->orderBy('name')
            ->get();

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name'   => 'required|string|max:255',
            'middle_name'  => 'nullable|string|max:255',
            'last_name'    => 'required|string|max:255',
            'contact_name' => 'nullable|string|max:255',
            'address'      => 'nullable|string|max:500',
            'email'        => 'required|email|unique:users,email',
            'role'         => 'required|in:admin,collector,manager,sysadmin,accounting_clerk',
            'password'     => ['required', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ], [
            'email.unique'       => 'This email is already in use. Please use a different one.',
            'email.email'        => 'Please enter a valid email address.',
            'password.confirmed' => 'Passwords do not match.',
        ]);

        foreach (['first_name', 'middle_name', 'last_name', 'contact_name'] as $field) {
            if (!empty($data[$field])) $data[$field] = strtoupper($data[$field]);
        }

        $nameParts = array_filter([$data['first_name'], $data['middle_name'] ?? null, $data['last_name']]);
        $data['name'] = implode(' ', $nameParts);

        $user = User::create([
            'name'         => $data['name'],
            'first_name'   => $data['first_name'],
            'middle_name'  => $data['middle_name'] ?? null,
            'last_name'    => $data['last_name'],
            'contact_name' => $data['contact_name'] ?? null,
            'address'      => $data['address'] ?? null,
            'email'        => $data['email'],
            'role'         => $data['role'],
            'password'     => Hash::make($data['password']),
            'is_approved'  => true,
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
            'first_name'   => 'sometimes|string|max:255',
            'middle_name'  => 'nullable|string|max:255',
            'last_name'    => 'sometimes|string|max:255',
            'contact_name' => 'nullable|string|max:255',
            'address'      => 'nullable|string|max:500',
            'email'        => "sometimes|email|unique:users,email,{$user->id}",
            'role'         => 'sometimes|in:admin,collector,manager,sysadmin,accounting_clerk',
            'password'     => ['sometimes', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ]);

        foreach (['first_name', 'middle_name', 'last_name', 'contact_name'] as $field) {
            if (!empty($data[$field])) $data[$field] = strtoupper($data[$field]);
        }

        if (isset($data['first_name']) || isset($data['last_name'])) {
            $fn = $data['first_name'] ?? $user->first_name;
            $mn = $data['middle_name'] ?? $user->middle_name;
            $ln = $data['last_name']   ?? $user->last_name;
            $data['name'] = implode(' ', array_filter([$fn, $mn, $ln]));
        }

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
            'id'           => $user->id,
            'name'         => $user->name,
            'first_name'   => $user->first_name,
            'middle_name'  => $user->middle_name,
            'last_name'    => $user->last_name,
            'contact_name' => $user->contact_name,
            'address'      => $user->address,
            'email'        => $user->email,
            'role'         => $user->role,
            'is_approved'  => $user->is_approved,
            'created_at'   => $user->created_at,
        ];
    }
}
