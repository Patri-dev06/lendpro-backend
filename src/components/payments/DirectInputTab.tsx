import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
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
  loan_type: string;
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
  delete_requested: boolean;
  delete_requested_by?: { first_name: string; last_name: string } | null;
  delete_requested_at: string | null;
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

  // Grouped the same way as the printed collection sheet, sorted alphabetically within each section
  const loanGroups = useMemo(() => {
    const alpha = (arr: ApiLoan[]) => [...arr].sort((a, b) => a.client.name.localeCompare(b.client.name));
    const isPastDue = (l: ApiLoan) => ["overdue", "past-due"].includes(l.status);
    return {
      active:      alpha(collectorLoans.filter((l) => !isPastDue(l) && l.loan_type !== "reconstruct")),
      reconstruct: alpha(collectorLoans.filter((l) => !isPastDue(l) && l.loan_type === "reconstruct")),
      pastDue:     alpha(collectorLoans.filter((l) => isPastDue(l))),
    };
  }, [collectorLoans]);

  // Rebuild entry rows in grouped order whenever collector changes
  useEffect(() => {
    const ordered = [...loanGroups.active, ...loanGroups.reconstruct, ...loanGroups.pastDue];
    setEntries(
      ordered.map((l) => ({
        loanId:  l.id,
        amount:  String(l.daily_payment),
        remarks: "",
      })),
    );
  }, [loanGroups]);

  const pagedHistory = useMemo(
    () => history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [history, page],
  );

  function updateEntry(loanId: number, field: "amount" | "remarks", value: string) {
    setEntries((prev) => prev.map((e) => e.loanId === loanId ? { ...e, [field]: value, error: undefined } : e));
  }

  const toSubmit = entries.filter((e) => parseFloat(e.amount) > 0 && !e.done);

  const isAdmin = role === "admin";

  async function handleRequestDelete(payment: ApiPayment) {
    if (!token) return;
    if (!window.confirm(`Request deletion of ₱${payment.amount.toFixed(2)} payment for ${payment.client.name}?\nAn administrator will need to approve it.`)) return;
    try {
      const updated = await apiRequest<ApiPayment>("POST", `payments/${payment.id}/request-delete`, { token });
      setHistory((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      toast.success("Deletion request submitted. Awaiting admin approval.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request deletion.");
    }
  }

  async function handleCancelDeleteRequest(payment: ApiPayment) {
    if (!token) return;
    try {
      const updated = await apiRequest<ApiPayment>("DELETE", `payments/${payment.id}/request-delete`, { token });
      setHistory((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      toast.success("Deletion request cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel request.");
    }
  }

  async function handleApproveDelete(payment: ApiPayment) {
    if (!token) return;
    if (!window.confirm(`Permanently delete this ₱${payment.amount.toFixed(2)} payment for ${payment.client.name}?\nThe loan balance will be restored.`)) return;
    try {
      await apiRequest("DELETE", `payments/${payment.id}`, { token });
      setHistory((prev) => prev.filter((p) => p.id !== payment.id));
      toast.success("Payment deleted and loan balance restored.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete payment.");
    }
  }

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
            <SearchableCombobox
              options={collectors.map((c) => ({
                value: String(c.id),
                label: c.name,
                sub: c.area || undefined,
              }))}
              value={collectorId}
              onChange={setCollectorId}
              placeholder="Search collector…"
            />
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
            <Table className="min-w-175">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-8">No.</TableHead>
                  <TableHead>Client / Business</TableHead>
                  <TableHead className="text-right">Daily Collection</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-36">Amount Paid (₱)</TableHead>
                  <TableHead className="w-44">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    { label: "Active", loans: loanGroups.active, color: "bg-emerald-50/70 dark:bg-emerald-950/20", textColor: "text-emerald-700 dark:text-emerald-400" },
                    { label: "Reconstruct", loans: loanGroups.reconstruct, color: "bg-blue-50/70 dark:bg-blue-950/20", textColor: "text-blue-700 dark:text-blue-400" },
                    { label: "Past Due / Overdue", loans: loanGroups.pastDue, color: "bg-red-50/70 dark:bg-red-950/20", textColor: "text-red-700 dark:text-red-400" },
                  ] as const
                ).map(({ label, loans: groupLoans, color, textColor }) => {
                  if (groupLoans.length === 0) return null;
                  return (
                    <React.Fragment key={label}>
                      <TableRow className={color}>
                        <TableCell colSpan={6} className={`py-1.5 px-5 text-xs font-semibold uppercase tracking-wider ${textColor}`}>
                          {label} ({groupLoans.length})
                        </TableCell>
                      </TableRow>
                      {groupLoans.map((loan, i) => {
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
                                ? "bg-emerald-50/40 opacity-60 dark:bg-emerald-950/20"
                                : !willSubmit
                                ? "opacity-40"
                                : ""
                            }
                          >
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <p className="font-medium leading-tight">{loan.client.name}</p>
                              <p className="text-xs text-muted-foreground">{loan.client.store_name}</p>
                            </TableCell>
                            <TableCell className="text-right num text-sm text-muted-foreground">{formatPHP(loan.daily_payment)}</TableCell>
                            <TableCell className="text-right num text-sm">{formatPHP(loan.current_balance)}</TableCell>
                            <TableCell>
                              {entry.done ? (
                                <span className="text-xs font-medium text-emerald-600">✓ Recorded</span>
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
                                      {entry.error ?? "Before release date"}
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
                    </React.Fragment>
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
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No payments recorded yet.</td></tr>
              ) : (<>
                {pagedHistory.map((p) => (
                  <TableRow key={p.id} className={p.delete_requested ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell>
                      <p className="font-medium leading-tight">{p.client.name}</p>
                      {p.delete_requested && (
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                          ⚠ Deletion requested{p.delete_requested_by ? ` by ${p.delete_requested_by.first_name} ${p.delete_requested_by.last_name}` : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right num font-medium">{formatPHP(p.amount)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{formatPHP(p.previous_balance)}</TableCell>
                    <TableCell className="text-right num">{formatPHP(p.new_balance)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.remarks ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {canEdit && !p.delete_requested && (
                          <Button variant="ghost" size="sm" className="h-7 px-2"
                            onClick={() => setEditTarget(p as PaymentToEdit)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isAdmin ? (
                          p.delete_requested ? (
                            <>
                              <Button variant="ghost" size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleApproveDelete(p)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground"
                                onClick={() => handleCancelDeleteRequest(p)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm"
                              className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleApproveDelete(p)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )
                        ) : (
                          p.delete_requested ? (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground"
                              title="Cancel your deletion request"
                              onClick={() => handleCancelDeleteRequest(p)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm"
                              className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Request deletion"
                              onClick={() => handleRequestDelete(p)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-muted/40">
                  <TableCell className="py-3 text-xs font-semibold text-muted-foreground">Total</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{history.length} transactions</TableCell>
                  <TableCell className="text-right num font-bold">{formatPHP(history.reduce((s, p) => s + p.amount, 0))}</TableCell>
                  <TableCell colSpan={4} />
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
