import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoItem } from "@/components/payments/InfoItem";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP, formatDate } from "@/lib/format";
import { LOAN_TYPE_LABELS } from "@/lib/loan-constants";
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
  const printRef = useRef<HTMLDivElement>(null);

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
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Client Ledger — ${client.name}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;padding:32px;color:#111;margin:0}
  h2{font-size:16px;margin:0 0 2px}.co{font-size:13px;font-weight:bold;margin-bottom:4px}
  .div2{border-top:2px solid #000;margin:10px 0}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:12px}
  .info-row{display:flex;gap:8px}.info-lbl{color:#555;min-width:110px}.info-val{font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#f0f0f0;font-size:10px;text-transform:uppercase;padding:6px 8px;border:1px solid #ccc}
  td{padding:5px 8px;border:1px solid #e0e0e0}
  .right{text-align:right}.paid{color:#16a34a}.pending{color:#9ca3af}.date-paid{color:#16a34a;font-weight:600}
  .total-row td{font-weight:bold;background:#f8f8f8;border-top:2px solid #aaa}
  .sig-block{display:flex;gap:40px;margin-top:32px}
  .sig{flex:1;text-align:center;font-size:9px}
  .sig-line{border-top:1px solid #000;margin-bottom:4px}
  .sig-name{font-weight:bold;font-size:10px}
  .sig-role{color:#555}
  @media print{body{padding:20px}}
</style></head><body>
<div class="co">BuenaMano Lending Corporation</div>
<h2>Client Ledger — ${client.name}</h2>
<div class="div2"></div>
<div class="info-grid">
  <div class="info-row"><span class="info-lbl">Client Name</span><span class="info-val">${client.name}</span></div>
  <div class="info-row"><span class="info-lbl">Loan Number</span><span class="info-val">${loan.number}</span></div>
  <div class="info-row"><span class="info-lbl">Store / Business</span><span class="info-val">${client.store_name}</span></div>
  <div class="info-row"><span class="info-lbl">Loan Type</span><span class="info-val">${LOAN_TYPE_LABELS[loan.loan_type as keyof typeof LOAN_TYPE_LABELS] ?? loan.loan_type}</span></div>
  <div class="info-row"><span class="info-lbl">Address</span><span class="info-val">${client.address}</span></div>
  <div class="info-row"><span class="info-lbl">Release Date</span><span class="info-val">${loan.release_date}</span></div>
  <div class="info-row"><span class="info-lbl">Phone</span><span class="info-val">${client.phone}</span></div>
  <div class="info-row"><span class="info-lbl">Due Date</span><span class="info-val">${loan.due_date}</span></div>
  <div class="info-row"><span class="info-lbl">Starting Balance</span><span class="info-val">${formatPHP(loan.total_receivable)}</span></div>
  <div class="info-row"><span class="info-lbl">Daily Payment</span><span class="info-val">${formatPHP(loan.daily_payment)}</span></div>
  <div class="info-row"><span class="info-lbl">Term of Loan</span><span class="info-val">${loan.term_days} days</span></div>
</div>
${content}
<div class="sig-block">
  <div class="sig">
    <br/><br/>
    <div class="sig-line"></div>
    <div class="sig-name">${ledger.client.name}</div>
    <div class="sig-role">Signature of Client</div>
    <div style="margin-top:4px">Date: _______________</div>
  </div>
  <div class="sig">
    <br/><br/>
    <div class="sig-line"></div>
    <div class="sig-name">___________________________</div>
    <div class="sig-role">Manager / Verified by</div>
    <div style="margin-top:4px">Date: _______________</div>
  </div>
</div>
<div style="margin-top:16px;font-size:9px;color:#888">Printed: ${new Date().toLocaleDateString("en-PH")} — BuenaMano Lending Corporation</div>
</body></html>`);
    win.document.close(); win.focus(); win.print();
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
            <Select value={String(selectedLoanId ?? "")} onValueChange={(v) => setSelectedLoanId(Number(v))}>
              <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Select a loan…" /></SelectTrigger>
              <SelectContent>
                {loans.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.client.name} — {l.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div ref={printRef} className="overflow-x-auto">
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
