import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditPaymentDialog, type PaymentToEdit } from "@/components/payments/EditPaymentDialog";
import { Paginator } from "@/components/shared/Paginator";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { hasPermission } from "@/lib/permissions";
import { formatPHP, formatDate } from "@/lib/format";
import { toast } from "sonner";

const PAGE_SIZE = 20;

interface ApiLoan {
  id: number;
  number: string;
  daily_payment: number;
  current_balance: number;
  release_date: string;
  status: string;
  client_id: number;
  collector_id: number;
  client: { id: number; name: string; store_name: string };
  collector: { id: number; name: string };
}

interface ApiPayment {
  id: number;
  payment_date: string;
  amount: number;
  previous_balance: number;
  new_balance: number;
  remarks: string | null;
  client: { name: string };
  loan: { release_date: string } | null;
}

interface Collector {
  id: number;
  name: string;
  area: string;
}

interface EntryRow {
  loanId: number;
  amount: string;
  remarks: string;
  error?: string;
  done?: boolean;
}

export function DirectInputTab() {
  const { token, role } = useRole();
  const canEdit = hasPermission(role, "payments:write");

  const [loans, setLoans]           = useState<ApiLoan[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [history, setHistory]       = useState<ApiPayment[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const [collectorId, setCollectorId] = useState<string>("");
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries]         = useState<EntryRow[]>([]);
  const [saving, setSaving]           = useState(false);
  const [editTarget, setEditTarget]   = useState<PaymentToEdit | null>(null);
  const [page, setPage]               = useState(1);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [loanData, payData, collData] = await Promise.all([
        apiRequest<ApiLoan[]>("GET", "loans", { token }),
        apiRequest<ApiPayment[]>("GET", "payments", { token }),
        apiRequest<Collector[]>("GET", "collectors", { token }),
      ]);
      const active = loanData.filter((l) => l.status !== "paid");
      setLoans(active);
      setHistory(payData);
      setCollectors(collData);
    } catch {
      toast.error("Failed to load payment data.");
    } finally {
      setLoadingInit(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [history]);

  // Loans belonging to the selected collector
  const collectorLoans = useMemo(
    () => collectorId ? loans.filter((l) => String(l.collector_id) === collectorId) : [],
    [loans, collectorId],
  );

  // Rebuild entry rows whenever collector changes
  useEffect(() => {
    setEntries(
      collectorLoans.map((l) => ({
        loanId:  l.id,
        amount:  String(l.daily_payment),
        remarks: "",
      })),
    );
  }, [collectorLoans]);

  const pagedHistory = useMemo(
    () => history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [history, page],
  );

  function updateEntry(loanId: number, field: "amount" | "remarks", value: string) {
    setEntries((prev) => prev.map((e) => e.loanId === loanId ? { ...e, [field]: value, error: undefined } : e));
  }

  const toSubmit = entries.filter((e) => parseFloat(e.amount) > 0 && !e.done);

  async function handleSubmitAll() {
    if (!token || toSubmit.length === 0) return;
    setSaving(true);
    let successCount = 0;

    const updated = [...entries];
    for (const entry of toSubmit) {
      const loan = loans.find((l) => l.id === entry.loanId);
      // client-side release date guard
      if (loan && date < loan.release_date.slice(0, 10)) {
        const idx = updated.findIndex((e) => e.loanId === entry.loanId);
        if (idx >= 0) updated[idx] = { ...updated[idx], error: `Before release date (${loan.release_date.slice(0, 10)})` };
        continue;
      }
      try {
        await apiRequest("POST", "payments", {
          token,
          body: { loan_id: entry.loanId, payment_date: date, amount: parseFloat(entry.amount), remarks: entry.remarks || null },
        });
        successCount++;
        const idx = updated.findIndex((e) => e.loanId === entry.loanId);
        if (idx >= 0) updated[idx] = { ...updated[idx], amount: "", remarks: "", done: true, error: undefined };
      } catch (err) {
        const idx = updated.findIndex((e) => e.loanId === entry.loanId);
        if (idx >= 0) updated[idx] = { ...updated[idx], error: err instanceof Error ? err.message : "Failed" };
      }
    }

    setEntries(updated);
    setSaving(false);

    if (successCount > 0) {
      toast.success(`${successCount} payment${successCount !== 1 ? "s" : ""} recorded successfully.`);
      await loadData();
    }
  }

  if (loadingInit) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedCollector = collectors.find((c) => String(c.id) === collectorId);

  return (
    <div className="space-y-6">

      {/* Entry card */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h3 className="font-display text-base font-semibold">Batch payment entry</h3>
          <p className="text-xs text-muted-foreground">
            Select a collector — all their active loans appear below. Set amount to 0 or clear to skip.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 px-5 py-4 border-b">
          <div className="space-y-1.5 min-w-48 flex-1">
            <p className="text-xs font-medium">Collector</p>
            <Select value={collectorId} onValueChange={setCollectorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select collector…" />
              </SelectTrigger>
              <SelectContent>
                {collectors.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}{c.area ? ` — ${c.area}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Collection date</p>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>

          {collectorId && (
            <div className="ml-auto flex items-center gap-2 self-end">
              <span className="text-xs text-muted-foreground">
                {toSubmit.length} of {entries.length} will be recorded
              </span>
              {canEdit && (
                <Button
                  onClick={handleSubmitAll}
                  disabled={saving || toSubmit.length === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary-glow"
                >
                  {saving
                    ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Recording…</>
                    : <><CheckCircle2 className="mr-1.5 h-4 w-4" />Record {toSubmit.length} payment{toSubmit.length !== 1 ? "s" : ""}</>
                  }
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Entry table */}
        {!collectorId ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Select a collector above to load their clients.
          </div>
        ) : collectorLoans.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {selectedCollector?.name} has no active loans.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-180">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Daily Due</TableHead>
                  <TableHead className="w-36">Amount Paid (₱)</TableHead>
                  <TableHead className="w-44">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collectorLoans.map((loan, i) => {
                  const entry = entries.find((e) => e.loanId === loan.id);
                  if (!entry) return null;
                  const amt = parseFloat(entry.amount);
                  const willSubmit = amt > 0 && !entry.done;
                  const beforeRelease = !!date && date < loan.release_date.slice(0, 10);

                  return (
                    <TableRow
                      key={loan.id}
                      className={
                        entry.done
                          ? "bg-emerald-50/60 opacity-60 dark:bg-emerald-950/20"
                          : !willSubmit
                          ? "opacity-50"
                          : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{loan.client.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{loan.client.store_name}</TableCell>
                      <TableCell className="text-right num text-sm">{formatPHP(loan.current_balance)}</TableCell>
                      <TableCell className="text-right num text-sm text-muted-foreground">{formatPHP(loan.daily_payment)}</TableCell>
                      <TableCell>
                        {entry.done ? (
                          <span className="text-xs font-medium text-emerald-600">✓ {formatPHP(0)}</span>
                        ) : (
                          <div>
                            <Input
                              type="number"
                              min={0}
                              value={entry.amount}
                              onChange={(e) => updateEntry(loan.id, "amount", e.target.value)}
                              className={`h-8 text-sm ${beforeRelease || entry.error ? "border-destructive" : ""}`}
                              disabled={saving}
                            />
                            {(beforeRelease || entry.error) && (
                              <p className="text-[10px] text-destructive mt-0.5 leading-tight">
                                {entry.error ?? `Before release date`}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {!entry.done && (
                          <Input
                            value={entry.remarks}
                            onChange={(e) => updateEntry(loan.id, "remarks", e.target.value)}
                            placeholder="Optional…"
                            className="h-8 text-sm"
                            disabled={saving}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h3 className="font-display text-base font-semibold">Recent payment history</h3>
          <p className="text-xs text-muted-foreground">{history.length} payments across all clients</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-150">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Previous</TableHead>
                <TableHead className="text-right">New balance</TableHead>
                <TableHead>Remarks</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <tr><td colSpan={canEdit ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">No payments recorded yet.</td></tr>
              ) : (<>
                {pagedHistory.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="font-medium">{p.client.name}</TableCell>
                    <TableCell className="text-right num font-medium">{formatPHP(p.amount)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{formatPHP(p.previous_balance)}</TableCell>
                    <TableCell className="text-right num">{formatPHP(p.new_balance)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.remarks ?? "—"}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 px-2"
                          onClick={() => setEditTarget(p as PaymentToEdit)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-muted/40">
                  <TableCell className="py-3 text-xs font-semibold text-muted-foreground">Total</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{history.length} transactions</TableCell>
                  <TableCell className="text-right num font-bold">{formatPHP(history.reduce((s, p) => s + p.amount, 0))}</TableCell>
                  <TableCell colSpan={canEdit ? 4 : 3} />
                </TableRow>
              </>)}
            </TableBody>
          </Table>
        </div>
        <Paginator page={page} pageSize={PAGE_SIZE} total={history.length} onPageChange={setPage} />
      </div>

      <EditPaymentDialog
        payment={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={loadData}
      />
    </div>
  );
}
