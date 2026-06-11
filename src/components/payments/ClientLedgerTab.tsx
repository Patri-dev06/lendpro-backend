import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Printer } from "lucide-react";
import { printLedger, type PrintScheduleRow } from "@/lib/loan-prints";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoItem } from "@/components/payments/InfoItem";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP, formatDate } from "@/lib/format";
import { toast } from "sonner";

interface ApiLoanSummary {
  id: number;
  number: string;
  status: string;
  client: { name: string };
}

interface LedgerRow {
  day: number;
  scheduled_date: string;
  payment_date: string | null;
  expected: number;
  actual: number;
  previous_balance: number;
  balance_after: number;
  status: string;
  remarks: string | null;
}

interface LedgerResponse {
  loan: {
    id: number;
    number: string;
    loan_type: string;
    principal: number;
    interest: number;
    service_charge: number;
    total_receivable: number;
    daily_payment: number;
    term_days: number;
    current_balance: number;
    release_date: string;
    due_date: string;
  };
  client: { name: string; store_name: string; address: string; phone: string };
  schedule: LedgerRow[];
  total_paid: number;
  total_pending: number;
}

export function ClientLedgerTab() {
  const { token } = useRole();

  const [loans, setLoans]           = useState<ApiLoanSummary[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [ledger, setLedger]         = useState<LedgerResponse | null>(null);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchLoans = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiLoanSummary[]>("GET", "loans", { token });
      setLoans(data);
      if (data.length > 0) setSelectedLoanId(data[0].id);
    } catch {
      toast.error("Failed to load loans.");
    } finally {
      setLoadingLoans(false);
    }
  }, [token]);

  const fetchLedger = useCallback(async (loanId: number) => {
    if (!token) return;
    setLoadingLedger(true);
    try {
      const data = await apiRequest<LedgerResponse>(
        "GET", `reports/client-ledger?loan_id=${loanId}`, { token }
      );
      setLedger(data);
    } catch {
      toast.error("Failed to load ledger.");
      setLedger(null);
    } finally {
      setLoadingLedger(false);
    }
  }, [token]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);
  useEffect(() => { if (selectedLoanId) fetchLedger(selectedLoanId); }, [selectedLoanId, fetchLedger]);

  function handlePrint() {
    if (!ledger) return;
    const { loan, client } = ledger;
    const schedule: PrintScheduleRow[] = ledger.schedule.map((r) => ({
      day:            r.day,
      scheduled_date: r.scheduled_date,
      expected:       r.expected,
      actual:         r.actual,
      balance_after:  r.balance_after,
      status:         r.status,
    }));
    printLedger(
      {
        number:          loan.number,
        loan_type:       loan.loan_type,
        principal:       loan.principal,
        interest:        loan.interest,
        service_charge:  loan.service_charge,
        total_receivable: loan.total_receivable,
        daily_payment:   loan.daily_payment,
        term_days:       loan.term_days,
        current_balance: loan.current_balance,
        release_date:    loan.release_date,
        due_date:        loan.due_date,
        client:          { name: client.name, store_name: client.store_name, address: client.address, phone: client.phone },
      },
      schedule,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Select Client / Loan</Label>
          {loadingLoans ? (
            <div className="flex h-9 w-72 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading…
            </div>
          ) : (
            <SearchableCombobox
              className="w-72"
              options={loans.map((l) => ({
                value: String(l.id),
                label: l.client.name,
                sub: l.number,
              }))}
              value={String(selectedLoanId ?? "")}
              onChange={(v) => setSelectedLoanId(Number(v))}
              placeholder="Search client or loan #…"
            />
          )}
        </div>
        <Button variant="outline" className="ml-auto" onClick={handlePrint} disabled={!ledger || loadingLedger}>
          <Printer className="mr-2 h-4 w-4" />Print Ledger
        </Button>
      </div>

      {loadingLedger ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : ledger ? (
        <>
          {/* Loan info card */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-4">
            <InfoItem label="Client"            value={ledger.client.name} />
            <InfoItem label="Loan #"            value={ledger.loan.number} />
            <InfoItem label="Release date"      value={formatDate(ledger.loan.release_date)} />
            <InfoItem label="Due date"          value={formatDate(ledger.loan.due_date)} />
            <InfoItem label="Total Payable" value={formatPHP(ledger.loan.total_receivable)} />
            <InfoItem label="Daily payment"      value={formatPHP(ledger.loan.daily_payment)} />
            <InfoItem label="Term of loan"       value={`${ledger.loan.term_days} days`} />
            <InfoItem label="Remaining balance" value={formatPHP(ledger.loan.current_balance)} highlight />
          </div>

          {/* Ledger table */}
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h3 className="font-display text-base font-semibold">Daily Payment Ledger</h3>
              <p className="text-xs text-muted-foreground">For reconciliation with client's own record (blue card)</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Paid</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.schedule.filter((r) => r.actual > 0).map((r) => (
                    <TableRow key={r.day}>
                      <TableCell className="text-sm">
                        <span className="text-success font-medium">
                          {formatDate(r.payment_date ?? r.scheduled_date)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right num font-medium">
                        <span className="text-success">{formatPHP(r.actual)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/40 font-bold">
                    <TableCell className="text-sm font-semibold">Total</TableCell>
                    <TableCell className="text-right num font-semibold text-success">{formatPHP(ledger.total_paid)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 text-center shadow-sm">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Select a client to view their ledger.</p>
        </div>
      )}
    </div>
  );
}
