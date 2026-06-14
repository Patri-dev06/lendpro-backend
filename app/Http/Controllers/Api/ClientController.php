<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->per_page ?? 100), 500);

        $paginator = Client::with([
                'collector',
                'loans' => fn ($q) => $q->whereNotIn('status', ['paid', 'pending']),
            ])
            ->when($request->search, fn ($q, $s) => $q->where(fn ($q2) =>
                $q2->where('name',       'ilike', "%$s%")
                   ->orWhere('store_name','ilike', "%$s%")
                   ->orWhere('number',    'ilike', "%$s%")
                   ->orWhere('first_name','ilike', "%$s%")
                   ->orWhere('last_name', 'ilike', "%$s%")
            ))
            ->when($request->type,         fn ($q, $t)  => $q->where('type', $t))
            ->when($request->status,       fn ($q, $s)  => $q->where('status', $s))
            ->when($request->collector_id, fn ($q, $id) => $q->where('collector_id', $id))
            ->orderBy('name')
            ->paginate($perPage);

        $paginator->getCollection()->transform(function ($client) {
            $arr = $client->toArray();
            $arr['has_outstanding_loan'] = $client->loans->isNotEmpty();
            return $arr;
        });

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name'   => 'required|string|max:255',
            'middle_name'  => 'nullable|string|max:255',
            'last_name'    => 'required|string|max:255',
            'store_name'   => 'required|string|max:255',
            'address'      => 'required|string',
            'phone'        => 'required|string|max:30',
            'email'        => 'nullable|email|max:255',
            'type'         => 'required|in:new,renew',
            'collector_id' => 'required|exists:collectors,id',
            'latitude'     => 'nullable|numeric|between:-90,90',
            'longitude'    => 'nullable|numeric|between:-180,180',
        ]);

        // Normalize to uppercase
        foreach (['first_name', 'middle_name', 'last_name', 'store_name', 'address'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = strtoupper($data[$field]);
            }
        }

        // Compose full name from parts
        $nameParts = array_filter([$data['first_name'], $data['middle_name'] ?? null, $data['last_name']]);
        $data['name'] = implode(' ', $nameParts);

        // Duplicate detection: same first+last name OR same store name (approved clients only)
        $dupByName = Client::where('first_name', $data['first_name'])
            ->where('last_name', $data['last_name'])
            ->where('approval_status', 'approved')
            ->exists();

        $dupByStore = Client::where('store_name', $data['store_name'])
            ->where('approval_status', 'approved')
            ->exists();

        $data['approval_status'] = ($dupByName || $dupByStore) ? 'pending_approval' : 'approved';
        $data['status']          = $data['type'];

        $reason = $dupByName && $dupByStore
            ? 'duplicate name and store'
            : ($dupByName ? 'duplicate name' : ($dupByStore ? 'duplicate store' : ''));

        $client = DB::transaction(function () use ($data, $reason) {
            $year           = now()->year;
            $seq            = Client::withTrashed()->whereYear('created_at', $year)->lockForUpdate()->count() + 1;
            $data['number'] = sprintf('CL-%d-%03d', $year, $seq);

            $client = Client::create($data);
            AuditLog::record(
                'CREATE_CLIENT',
                $client->number,
                "Created client {$client->name}" . ($reason ? " — pending approval ({$reason})" : '')
            );
            return $client;
        });

        return response()->json(
            array_merge($client->load('collector')->toArray(), ['has_outstanding_loan' => false]),
            201
        );
    }

    public function show(Client $client): JsonResponse
    {
        return response()->json($client->load(['collector', 'loans.scheduleRows', 'payments.collector']));
    }

    public function update(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'first_name'   => 'sometimes|string|max:255',
            'middle_name'  => 'nullable|string|max:255',
            'last_name'    => 'sometimes|string|max:255',
            'store_name'   => 'sometimes|string|max:255',
            'address'      => 'sometimes|string',
            'phone'        => 'sometimes|string|max:30',
            'email'        => 'nullable|email|max:255',
            'type'         => 'sometimes|in:new,renew',
            'collector_id' => 'sometimes|exists:collectors,id',
            'status'       => 'sometimes|in:new,renew,overdue,past-due,paid',
            'latitude'     => 'nullable|numeric|between:-90,90',
            'longitude'    => 'nullable|numeric|between:-180,180',
        ]);

        // Normalize to uppercase
        foreach (['first_name', 'middle_name', 'last_name', 'store_name', 'address'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = strtoupper($data[$field]);
            }
        }

        // Recompose full name if any name part is being updated
        $firstName  = $data['first_name']  ?? $client->first_name;
        $middleName = array_key_exists('middle_name', $data) ? $data['middle_name'] : $client->middle_name;
        $lastName   = $data['last_name']   ?? $client->last_name;

        if (isset($data['first_name']) || array_key_exists('middle_name', $data) || isset($data['last_name'])) {
            $data['name'] = implode(' ', array_filter([$firstName, $middleName, $lastName]));
        }

        $client->update($data);

        AuditLog::record('UPDATE_CLIENT', $client->number, "Updated client {$client->name}");

        return response()->json($client->load('collector'));
    }

    public function approve(Client $client): JsonResponse
    {
        if ($client->approval_status !== 'pending_approval') {
            return response()->json(['message' => 'Client is not pending approval.'], 422);
        }

        $client->update(['approval_status' => 'approved']);
        AuditLog::record('APPROVE_CLIENT', $client->number, "Approved duplicate client {$client->name}");

        return response()->json(
            array_merge($client->load('collector')->toArray(), ['has_outstanding_loan' => false])
        );
    }

    public function reject(Client $client): JsonResponse
    {
        if ($client->approval_status !== 'pending_approval') {
            return response()->json(['message' => 'Client is not pending approval.'], 422);
        }

        $number = $client->number;
        $name   = $client->name;
        $client->forceDelete();

        AuditLog::record('REJECT_CLIENT', $number, "Rejected duplicate client {$name}");

        return response()->json(['message' => 'Client rejected and removed.']);
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->delete();
        AuditLog::record('DELETE_CLIENT', $client->number, "Deleted client {$client->name}");
        return response()->json(['message' => 'Client deleted.']);
    }
}
