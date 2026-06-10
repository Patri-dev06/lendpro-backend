import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Download, Loader2, Printer } from "lucide-react";
import { printLedger, type PrintScheduleRow } from "@/lib/loan-prints";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/shared/DateInput";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP, formatDate, addDays } from "@/lib/format";
import { toast } from "sonner";

function fmtDate(s: string): string {
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? s : formatDate(d);
}

interface ApiLoan {
  id: number;
  number: string;
  total_receivable: number;
  daily_payment: number;
  current_balance: number;
  release_date: string;
  due_date: string;
  term_days: number;
  holiday_count: number;
  status: string;
  client: { name: string; store_name: string };
  collector: { name: string };
}

interface ScheduleRow {
  id: number;
  scheduled_date: string;
  payment_date: string | null;
  expected: number;
  actual: number;
  previous_balance: number;
  balance_after: number;
  status: string;
  remarks: string | null;
}

export function CollectionScheduleSection() {
  const { token } = useRole();
  const [loans, setLoans]               = useState<ApiLoan[]>([]);
  const [loanId, setLoanId]             = useState<number | null>(null);
  const [rows, setRows]                 = useState<ScheduleRow[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loadingRows, setLoadingRows]   = useState(false);
  const [printing, setPrinting]         = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");

  const [editingDate, setEditingDate]       = useState(false);
  const [newReleaseDate, setNewReleaseDate] = useState("");
  const [rescheduling, setRescheduling]     = useState(false);

  const fetchLoans = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiLoan[]>("GET", "loans", { token });
      setLoans(data);
      if (data.length > 0) setLoanId(data[0].id);
    } catch {
      toast.error("Failed to load loans.");
    } finally {
      setLoadingLoans(false);
    }
  }, [token]);

  const fetchSchedule = useCallback(async (id: number) => {
    if (!token) return;
    setLoadingRows(true);
    try {
      const data = await apiRequest<ScheduleRow[]>("GET", `loans/${id}/schedule`, { token });
      setRows(data);
    } catch {
      toast.error("Failed to load schedule.");
    } finally {
      setLoadingRows(false);
    }
  }, [token]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);
  useEffect(() => { if (loanId) fetchSchedule(loanId); }, [loanId, fetchSchedule]);

  const loan = loans.find((l) => l.id === loanId);

  async function handleReschedule() {
    if (!loan || !newReleaseDate || !token) return;
    setRescheduling(true);
    try {
      const updated = await apiRequest<ApiLoan>("PATCH", `loans/${loan.id}/reschedule`, {
        token,
        body: { release_date: newReleaseDate },
      });
      setLoans((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      if (loanId) fetchSchedule(loanId);
      toast.success(`Release date updated to ${fmtDate(newReleaseDate)}.`);
      setEditingDate(false);
      setNewReleaseDate("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update release date.");
    } finally {
      setRescheduling(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (!r.actual) return false;
    if (fromDate && (r.payment_date ?? r.scheduled_date) < fromDate) return false;
    if (toDate   && (r.payment_date ?? r.scheduled_date) > toDate)   return false;
    return true;
  });

  async function handlePrint() {
    if (!loan || !token) return;
    setPrinting(true);
    try {
      const data = await apiRequest<{
        loan: { number: string; loan_type: string; principal: number; interest: number; service_charge: number;
          total_receivable: number; daily_payment: number; term_days: number; current_balance: number;
          release_date: string; due_date: string };
        client: { name: string; store_name: string; address: string; phone: string };
        schedule: PrintScheduleRow[];
      }>("GET", `reports/client-ledger?loan_id=${loan.id}`, { token });
      printLedger({ ...data.loan, client: data.client }, data.schedule);
    } catch {
      printLedger({
        number: loan.number, loan_type: "", principal: 0, interest: 0, service_charge: 0,
        total_receivable: loan.total_receivable, daily_payment: loan.daily_payment,
        term_days: loan.term_days, current_balance: loan.current_balance,
        release_date: loan.release_date, due_date: loan.due_date,
        client: { name: loan.client.name, store_name: loan.client.store_name, address: "", phone: "" },
      });
    } finally {
      setPrinting(false);
    }
  }

  function handleExport() {
    if (!loan || filtered.length === 0) return;
    const header = "Date Paid,Amount Paid";
    const csv = filtered.map((r) => [r.payment_date ?? r.scheduled_date, r.actual].join(",")).join("\n");
    const blob = new Blob([header + "\n" + csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `schedule-${loan.number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {loan ? (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Schedule for</p>
              <h3 className="font-display text-xl font-semibold">{loan.client.name}</h3>
              <p className="text-sm text-muted-foreground">{loan.client.store_name} · Loan {loan.number}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <KV label="Release date"     value={fmtDate(loan.release_date)} />
              <KV label="Due date"         value={fmtDate(loan.due_date)} />
              <KV label="Total receivable" value={formatPHP(loan.total_receivable)} />
              <KV label="Daily payment"    value={formatPHP(loan.daily_payment)} />
              <KV label="Current balance"  value={formatPHP(loan.current_balance)} highlight />
              <KV label="Status"           value={<StatusBadge status={loan.status} />} />
            </div>
          </div>
        </div>
      ) : (
        !loadingLoans && (
          <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            No loans found. Create a loan first.
          </div>
        )
      )}

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          {loadingLoans ? (
            <div className="flex h-9 w-72 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading loans…
            </div>
          ) : (
            <SearchableCombobox
              options={loans.map((l) => ({
                value: String(l.id),
                label: `${l.number} — ${l.client.name}`,
                sub: l.client.store_name,
              }))}
              value={String(loanId ?? "")}
              onChange={(v) => setLoanId(Number(v))}
              placeholder="Search by loan #, client name…"
              className="w-72"
            />
          )}
          <Input type="date" className="h-9 w-44" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" className="h-9 w-44" value={toDate}   onChange={(e) => setToDate(e.target.value)} />
          {(fromDate || toDate) && (
            <Button variant="ghost" size="sm" className="h-9 text-xs"
              onClick={() => { setFromDate(""); setToDate(""); }}>
              Clear filters
            </Button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {loan?.status === "pending" && (
              <Button variant="outline" size="sm"
                onClick={() => { setNewReleaseDate(loan.release_date); setEditingDate(true); }}>
                <CalendarClock className="mr-1.5 h-4 w-4" />Change Release Date
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing || !loan}>
              {printing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
              {printing ? "Printing…" : "Print"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="mr-1.5 h-4 w-4" />Export
            </Button>
          </div>
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
              {loadingRows ? (
                <tr><td colSpan={2} className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={2} className="py-12 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No schedule rows found." : "No payments recorded yet."}
                </td></tr>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{fmtDate(r.payment_date ?? r.scheduled_date)}</TableCell>
                  <TableCell className="text-right num font-medium">{formatPHP(r.actual)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={editingDate} onOpenChange={(o) => { if (!o) { setEditingDate(false); setNewReleaseDate(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Release Date</DialogTitle>
          </DialogHeader>
          {loan && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan</span>
                  <span className="font-medium">{loan.number} — {loan.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current release date</span>
                  <span className="font-medium">{fmtDate(loan.release_date)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>New release date</Label>
                <DateInput value={newReleaseDate} onChange={(e) => setNewReleaseDate(e.target.value)} />
              </div>
              {newReleaseDate && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
                  <span className="text-muted-foreground">New due date: </span>
                  <span className="font-semibold">
                    {addDays(newReleaseDate + "T00:00:00", loan.term_days + loan.holiday_count)
                      .toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingDate(false); setNewReleaseDate(""); }} disabled={rescheduling}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={!newReleaseDate || rescheduling}>
              {rescheduling ? "Saving…" : "Save New Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-semibold num">{value}</p>
    </div>
  );
}
