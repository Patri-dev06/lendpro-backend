<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Client;
use App\Models\Collector;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /* ---- Users ---- */
        $admin = User::create([
            'name'        => 'Alex Dela Cruz',
            'email'       => 'alex@lendpro.ph',
            'password'    => Hash::make('password'),
            'role'        => 'admin',
            'is_approved' => true,
        ]);
        User::create(['name' => 'Grace Sy',   'email' => 'grace.sy@lendpro.ph',   'password' => Hash::make('password'), 'role' => 'manager',          'is_approved' => true]);
        User::create(['name' => 'IT Admin',   'email' => 'it@lendpro.ph',         'password' => Hash::make('password'), 'role' => 'sysadmin',         'is_approved' => true]);
        User::create(['name' => 'Accounting', 'email' => 'accounting@lendpro.ph', 'password' => Hash::make('password'), 'role' => 'accounting_clerk', 'is_approved' => true]);

        /* ---- Collectors ---- */
        $collectors = collect([
            ['name' => 'Mark Rivera',  'code' => 'Collector A', 'area' => 'Quezon City'],
            ['name' => 'Sheila Cruz',  'code' => 'Collector B', 'area' => 'Manila'],
            ['name' => 'John Ramos',   'code' => 'Collector C', 'area' => 'Pasig'],
            ['name' => 'Liza Mendoza', 'code' => 'Collector D', 'area' => 'Makati'],
        ])->map(fn ($d) => Collector::create($d));

        [$c1, $c2, $c3, $c4] = $collectors->values()->all();

        /* Collector users */
        foreach ([
            ['name' => 'Mark Rivera',  'email' => 'mark.rivera@lendpro.ph',  'role' => 'collector'],
            ['name' => 'Sheila Cruz',  'email' => 'sheila.cruz@lendpro.ph',  'role' => 'collector'],
            ['name' => 'John Ramos',   'email' => 'john.ramos@lendpro.ph',   'role' => 'collector'],
            ['name' => 'Liza Mendoza', 'email' => 'liza.mendoza@lendpro.ph', 'role' => 'collector'],
        ] as $u) {
            User::create(array_merge($u, ['password' => Hash::make('password'), 'is_approved' => true]));
        }

        /* ---- Clients ---- */
        $clientData = [
            ['number' => 'CL-2025-001', 'name' => 'Juan Dela Cruz',  'store_name' => 'Juan Sari-Sari Store',     'address' => '12 Mabini St., Quezon City', 'phone' => '+63 917 123 4567', 'email' => null,                        'type' => 'new',   'collector_id' => $c1->id, 'status' => 'new'],
            ['number' => 'CL-2025-002', 'name' => 'Maria Santos',    'store_name' => 'Maria Mini Mart',          'address' => '45 Rizal Ave., Manila',      'phone' => '+63 918 555 1212', 'email' => 'maria.santos@gmail.com',    'type' => 'renew', 'collector_id' => $c2->id, 'status' => 'renew'],
            ['number' => 'CL-2025-003', 'name' => 'Roberto Reyes',   'store_name' => 'RJR General Merchandise',  'address' => '78 Ortigas Ave., Pasig',     'phone' => '+63 920 444 7788', 'email' => null,                        'type' => 'renew', 'collector_id' => $c3->id, 'status' => 'overdue'],
            ['number' => 'CL-2025-004', 'name' => 'Ana Villanueva',  'store_name' => 'AV Store',                 'address' => '10 Ayala Blvd., Makati',     'phone' => '+63 915 222 9090', 'email' => 'ana.villanueva@gmail.com',  'type' => 'new',   'collector_id' => $c4->id, 'status' => 'paid'],
            ['number' => 'CL-2025-005', 'name' => 'Pedro Gonzales',  'store_name' => "Pedro's Bakery",           'address' => '5 Katipunan, QC',            'phone' => '+63 917 998 1122', 'email' => null,                        'type' => 'renew', 'collector_id' => $c1->id, 'status' => 'past-due'],
            ['number' => 'CL-2025-006', 'name' => 'Liza Bautista',   'store_name' => 'LB Carenderia',            'address' => '23 Taft Ave., Manila',       'phone' => '+63 919 333 6677', 'email' => 'liza.bautista@gmail.com',   'type' => 'new',   'collector_id' => $c2->id, 'status' => 'new'],
            ['number' => 'CL-2025-007', 'name' => 'Carlos Mercado',  'store_name' => 'Mercado Hardware',         'address' => '88 C. Raymundo, Pasig',      'phone' => '+63 916 700 1234', 'email' => null,                        'type' => 'renew', 'collector_id' => $c3->id, 'status' => 'overdue'],
            ['number' => 'CL-2025-008', 'name' => 'Grace Lim',       'store_name' => 'Grace Beauty Shop',        'address' => '9 Buendia, Makati',          'phone' => '+63 918 121 3434', 'email' => null,                        'type' => 'new',   'collector_id' => $c4->id, 'status' => 'new'],
            ['number' => 'CL-2025-009', 'name' => 'Miguel Tan',      'store_name' => 'Tan Auto Parts',           'address' => '34 EDSA, QC',                'phone' => '+63 917 565 7878', 'email' => 'miguel.tan@email.com',      'type' => 'renew', 'collector_id' => $c1->id, 'status' => 'renew'],
            ['number' => 'CL-2025-010', 'name' => 'Rosa Aquino',     'store_name' => 'Aquino Grocery',           'address' => '16 Aurora Blvd., QC',        'phone' => '+63 920 111 2233', 'email' => null,                        'type' => 'new',   'collector_id' => $c2->id, 'status' => 'paid'],
        ];

        $clients = collect($clientData)->map(fn ($d) => Client::create($d));

        /* ---- Loans ---- */
        $loanData = [
            ['client' => $clients[0], 'collector' => $c1, 'loan_type' => 'new-loan',    'principal' => 10000, 'interest' => 1500, 'service_charge' => 500,  'daily_payment' => 267, 'term_days' => 45, 'current_balance' => 8750,  'release_date' => '2025-04-15', 'due_date' => '2025-06-14', 'status' => 'new'],
            ['client' => $clients[1], 'collector' => $c2, 'loan_type' => 'reloan',      'principal' => 20000, 'interest' => 3000, 'service_charge' => 1000, 'daily_payment' => 533, 'term_days' => 45, 'current_balance' => 12500, 'release_date' => '2025-03-10', 'due_date' => '2025-05-08', 'status' => 'renew'],
            ['client' => $clients[2], 'collector' => $c3, 'loan_type' => 'new-loan',    'principal' => 15000, 'interest' => 2250, 'service_charge' => 750,  'daily_payment' => 300, 'term_days' => 60, 'current_balance' => 14700, 'release_date' => '2025-04-01', 'due_date' => '2025-06-27', 'status' => 'overdue'],
            ['client' => $clients[3], 'collector' => $c4, 'loan_type' => 'new-loan',    'principal' => 8000,  'interest' => 1200, 'service_charge' => 400,  'daily_payment' => 320, 'term_days' => 30, 'current_balance' => 0,     'release_date' => '2025-01-05', 'due_date' => '2025-02-14', 'status' => 'paid'],
            ['client' => $clients[4], 'collector' => $c1, 'loan_type' => 'reloan',      'principal' => 25000, 'interest' => 3750, 'service_charge' => 1250, 'daily_payment' => 500, 'term_days' => 60, 'current_balance' => 9000,  'release_date' => '2024-12-01', 'due_date' => '2025-02-26', 'status' => 'past-due'],
            ['client' => $clients[5], 'collector' => $c2, 'loan_type' => 'new-loan',    'principal' => 12000, 'interest' => 1800, 'service_charge' => 600,  'daily_payment' => 320, 'term_days' => 45, 'current_balance' => 11400, 'release_date' => '2025-04-20', 'due_date' => '2025-06-19', 'status' => 'new'],
            ['client' => $clients[6], 'collector' => $c3, 'loan_type' => 'reconstruct', 'principal' => 18000, 'interest' => 2700, 'service_charge' => 900,  'daily_payment' => 360, 'term_days' => 60, 'current_balance' => 16200, 'release_date' => '2025-04-05', 'due_date' => '2025-07-02', 'status' => 'overdue'],
            ['client' => $clients[7], 'collector' => $c4, 'loan_type' => 'new-loan',    'principal' => 10000, 'interest' => 1500, 'service_charge' => 500,  'daily_payment' => 267, 'term_days' => 45, 'current_balance' => 10750, 'release_date' => '2025-04-25', 'due_date' => '2025-06-24', 'status' => 'new'],
            ['client' => $clients[8], 'collector' => $c1, 'loan_type' => 'reloan',      'principal' => 30000, 'interest' => 4500, 'service_charge' => 1500, 'daily_payment' => 600, 'term_days' => 60, 'current_balance' => 18900, 'release_date' => '2025-03-15', 'due_date' => '2025-06-11', 'status' => 'renew'],
            ['client' => $clients[9], 'collector' => $c2, 'loan_type' => 'new-loan',    'principal' => 9000,  'interest' => 1350, 'service_charge' => 450,  'daily_payment' => 240, 'term_days' => 45, 'current_balance' => 0,     'release_date' => '2025-01-20', 'due_date' => '2025-03-19', 'status' => 'paid'],
        ];

        $loans = [];
        foreach ($loanData as $i => $d) {
            $total = $d['principal'] + $d['interest'] + $d['service_charge'];
            $num   = sprintf('LN-2025-%04d', $i + 1);
            $loan  = Loan::create([
                'number'           => $num,
                'client_id'        => $d['client']->id,
                'collector_id'     => $d['collector']->id,
                'loan_type'        => $d['loan_type'],
                'principal'        => $d['principal'],
                'interest'         => $d['interest'],
                'service_charge'   => $d['service_charge'],
                'total_receivable' => $total,
                'daily_payment'    => $d['daily_payment'],
                'term_days'        => $d['term_days'],
                'current_balance'  => $d['current_balance'],
                'release_date'     => $d['release_date'],
                'due_date'         => $d['due_date'],
                'expected_end_date'=> $d['due_date'],
                'status'           => $d['status'],
            ]);
            $loan->generateSchedule();
            $loans[] = $loan;
        }

        /* ---- Payments ---- */
        $paymentData = [
            ['loan' => $loans[0], 'client' => $clients[0], 'collector' => $c1, 'date' => '2025-05-14', 'amount' => 267,  'prev' => 9017,  'new' => 8750],
            ['loan' => $loans[1], 'client' => $clients[1], 'collector' => $c2, 'date' => '2025-05-14', 'amount' => 533,  'prev' => 13033, 'new' => 12500],
            ['loan' => $loans[2], 'client' => $clients[2], 'collector' => $c3, 'date' => '2025-05-13', 'amount' => 200,  'prev' => 14900, 'new' => 14700, 'remarks' => 'Partial payment'],
            ['loan' => $loans[5], 'client' => $clients[5], 'collector' => $c2, 'date' => '2025-05-14', 'amount' => 320,  'prev' => 11720, 'new' => 11400],
            ['loan' => $loans[8], 'client' => $clients[8], 'collector' => $c1, 'date' => '2025-05-14', 'amount' => 600,  'prev' => 19500, 'new' => 18900],
            ['loan' => $loans[0], 'client' => $clients[0], 'collector' => $c1, 'date' => '2025-05-13', 'amount' => 267,  'prev' => 9284,  'new' => 9017],
            ['loan' => $loans[6], 'client' => $clients[6], 'collector' => $c3, 'date' => '2025-05-12', 'amount' => 360,  'prev' => 16560, 'new' => 16200],
        ];

        foreach ($paymentData as $p) {
            Payment::create([
                'loan_id'          => $p['loan']->id,
                'client_id'        => $p['client']->id,
                'collector_id'     => $p['collector']->id,
                'recorded_by'      => $admin->id,
                'payment_date'     => $p['date'],
                'amount'           => $p['amount'],
                'previous_balance' => $p['prev'],
                'new_balance'      => $p['new'],
                'remarks'          => $p['remarks'] ?? null,
            ]);
        }

        /* ---- Audit logs ---- */
        AuditLog::create(['user_id' => $admin->id, 'action' => 'CREATE_LOAN',    'record' => 'LN-2025-0010', 'description' => 'Created loan for Rosa Aquino',        'performed_at' => '2025-05-14 09:12:00']);
        AuditLog::create(['user_id' => 2,           'action' => 'RECORD_PAYMENT', 'record' => 'LN-2025-0001', 'description' => 'Recorded ₱267.00 payment',            'performed_at' => '2025-05-14 09:45:00']);
        AuditLog::create(['user_id' => $admin->id, 'action' => 'UPDATE_CLIENT',  'record' => 'CL-2025-003',  'description' => 'Updated contact number',               'performed_at' => '2025-05-14 11:00:00']);
        AuditLog::create(['user_id' => 3,           'action' => 'FLAG_OVERDUE',   'record' => 'CL-2025-007',  'description' => 'Marked client overdue +3 days',        'performed_at' => '2025-05-14 11:22:00']);
    }
}
