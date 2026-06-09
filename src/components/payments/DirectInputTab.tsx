import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { Field } from "@/components/shared/Field";
import { BalanceCard } from "@/components/payments/BalanceCard";
import { EditPaymentDialog, type PaymentToEdit } from "@/components/payments/EditPaymentDialog";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { hasPermission } from "@/lib/permissions";
import { formatPHP, formatDate } from "@/lib/format";
import { calcNewBalance } from "@/lib/loan-calc";
import { toast } from "sonner";

interface ApiLoan {
  id: number;
  number: string;
  daily_payment: number;
  current_balance: number;
  status: string;
  client_id: number;
  client: { id: number; name: string; store_name: string };
}

interface ApiPayment {
  id: number;
  payment_date: string;
  amount: number;
  previous_balance: number;
  new_balance: number;
  remarks: string | null;
  client: { name: string };
}

export function DirectInputTab() {
  const { token, role } = useRole();
  const canEdit = hasPermission(role, "payments:write");

  const [loans, setLoans]     = useState<ApiLoan[]>([]);
  const [history, setHistory] = useState<ApiPayment[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [amount, setAmount]   = useState(0);
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving]   = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentToEdit | null>(null);

  const selectedLoan = loans.find((l) => l.id === selectedLoanId);
  const newBalance   = calcNewBalance(selectedLoan?.current_balance ?? 0, amount);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [loanData, payData] = await Promise.all([
        apiRequest<ApiLoan[]>("GET", "loans", { token }),
        apiRequest<ApiPayment[]>("GET", "payments", { token }),
      ]);
      const active = loanData.filter((l) => l.status !== "paid");
      setLoans(active);
      setHistory(payData.slice(0, 20));
      setSelectedLoanId(null);
      setAmount(0);
    } catch {
      toast.error("Failed to load payment data.");
    } finally {
      setLoadingInit(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleLoanChange(id: number) {
    setSelectedLoanId(id);
    const loan = loans.find((l) => l.id === id);
    if (loan) setAmount(loan.daily_payment);
  }

  async function handleSubmit() {
    if (!token || !selectedLoanId || amount <= 0) {
      toast.error("Please select a loan and enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<{ amount: number; new_balance: number }>("POST", "payments", {
        token,
        body: { loan_id: selectedLoanId, payment_date: date, amount, remarks: remarks || null },
      });
      toast.success(`Payment of ${formatPHP(result.amount)} recorded.`, {
        description: `New balance: ${formatPHP(result.new_balance)}`,
      });
      setRemarks("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingInit) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h3 className="font-display text-base font-semibold">Payment details</h3>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client">
              <SearchableCombobox
                options={loans.map((l) => ({
                  value: String(l.id),
                  label: l.client.name,
                  sub: l.client.store_name,
                }))}
                value={String(selectedLoanId ?? "")}
                onChange={(v) => handleLoanChange(Number(v))}
                placeholder="Search by client name or store…"
              />
            </Field>

            <Field label="Loan number">
              <Input value={selectedLoan?.number ?? "—"} readOnly className="bg-muted/40 text-muted-foreground" />
            </Field>

            <Field label="Outstanding balance">
              <Input value={formatPHP(selectedLoan?.current_balance ?? 0)} readOnly className="bg-muted/40 text-muted-foreground" />
            </Field>

            <Field label="Expected payment today">
              <Input value={formatPHP(selectedLoan?.daily_payment ?? 0)} readOnly className="bg-muted/40 text-muted-foreground" />
            </Field>

            <Field label="Payment amount (₱)">
              <Input type="number" min={0.01} value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)} />
            </Field>

            <Field label="Payment date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>

            <Field label="Remarks" full>
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes…" />
            </Field>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setRemarks("");
              if (selectedLoan) setAmount(selectedLoan.daily_payment);
            }}>Reset</Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary-glow"
              onClick={handleSubmit}
              disabled={saving || !selectedLoanId || amount <= 0}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wallet className="mr-1.5 h-4 w-4" />}
              {saving ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <BalanceCard label="Previous balance"          value={formatPHP(selectedLoan?.current_balance ?? 0)} tone="muted" />
          <BalanceCard label="Payment amount"            value={formatPHP(amount)}     tone="info" />
          <BalanceCard label="New balance after payment" value={formatPHP(newBalance)} tone="success" big />
        </div>
      </div>

      {/* Recent history */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h3 className="font-display text-base font-semibold">Recent payment history</h3>
          <p className="text-xs text-muted-foreground">Last 20 payments across all clients</p>
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
              ) : history.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="font-medium">{p.client.name}</TableCell>
                  <TableCell className="text-right num font-medium">{formatPHP(p.amount)}</TableCell>
                  <TableCell className="text-right num text-muted-foreground">{formatPHP(p.previous_balance)}</TableCell>
                  <TableCell className="text-right num">{formatPHP(p.new_balance)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.remarks ?? "—"}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setEditTarget(p as PaymentToEdit)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <EditPaymentDialog
        payment={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={loadData}
      />
    </div>
  );
}
