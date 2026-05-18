<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $clients = Client::with(['collector', 'loans' => fn ($q) => $q->whereNotIn('status', ['paid'])])
            ->when($request->search, fn ($q, $s) => $q->where(fn ($q2) =>
                $q2->where('name', 'like', "%$s%")
                   ->orWhere('store_name', 'like', "%$s%")
                   ->orWhere('number', 'like', "%$s%")
            ))
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->collector_id, fn ($q, $id) => $q->where('collector_id', $id))
            ->orderBy('name')
            ->get();

        return response()->json($clients);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'         => 'required|string|max:255',
            'store_name'   => 'required|string|max:255',
            'address'      => 'required|string',
            'phone'        => 'required|string|max:30',
            'email'        => 'nullable|email|max:255',
            'type'         => 'required|in:new,renew',
            'collector_id' => 'required|exists:collectors,id',
        ]);

        $year   = now()->year;
        $seq    = Client::whereYear('created_at', $year)->count() + 1;
        $data['number'] = sprintf('CL-%d-%03d', $year, $seq);
        $data['status'] = $data['type'];

        $client = Client::create($data);

        AuditLog::record('CREATE_CLIENT', $client->number, "Created client {$client->name}");

        return response()->json($client->load('collector'), 201);
    }

    public function show(Client $client): JsonResponse
    {
        return response()->json($client->load(['collector', 'loans.scheduleRows', 'payments.collector']));
    }

    public function update(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'store_name'   => 'sometimes|string|max:255',
            'address'      => 'sometimes|string',
            'phone'        => 'sometimes|string|max:30',
            'email'        => 'nullable|email|max:255',
            'type'         => 'sometimes|in:new,renew',
            'collector_id' => 'sometimes|exists:collectors,id',
            'status'       => 'sometimes|in:new,renew,overdue,past-due,paid',
        ]);

        $client->update($data);

        AuditLog::record('UPDATE_CLIENT', $client->number, "Updated client {$client->name}");

        return response()->json($client->load('collector'));
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->delete();
        AuditLog::record('DELETE_CLIENT', $client->number, "Deleted client {$client->name}");
        return response()->json(['message' => 'Client deleted.']);
    }
}
