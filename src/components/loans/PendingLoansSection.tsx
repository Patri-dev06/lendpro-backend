import { useState } from "react";
import { CalendarClock, CheckCircle2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/shared/DateInput";
import { formatPHP, formatDate, addDays } from "@/lib/format";
import { calcInterest, calcDailyPayment } from "@/lib/loan-calc";
import { LOAN_TYPE_LABELS, type LoanType, TERM_OPTIONS } from "@/lib/loan-constants";

// Parse any date format the API returns (ISO UTC, ISO+offset, or plain YYYY-MM-DD)
// and display in local (Manila) timezone
function fmtApiDate(s: string): string {
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? s : formatDate(d);
}
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import type { ApiLoan } from "@/components/loans/LoanCreateSection";

interface Props {
  token: string | null;
  loans: ApiLoan[];
  onLoansChanged: (updated: ApiLoan[], removedId?: number) => void;
}

export function PendingLoansSection({ token, loans, onLoansChanged }: Props) {
  const [confirmTarget, setConfirmTarget] = useState<ApiLoan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ApiLoan | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Edit pending loan state
  const [editTarget, setEditTarget]             = useState<ApiLoan | null>(null);
  const [editLoanType, setEditLoanType]         = useState<LoanType>("new-loan");
  const [editPrincipal, setEditPrincipal]       = useState(0);
  const [editInterest, setEditInterest]         = useState(0);
  const [editSc, setEditSc]                     = useState(0);
  const [editTermDays, setEditTermDays]         = useState(60);
  const [editHolidayCount, setEditHolidayCount] = useState(0);
  const [editDaily, setEditDaily]               = useState(0);
  const [editDate, setEditDate]                 = useState("");
  const [editRemarks, setEditRemarks]           = useState("");
  const [editErrors, setEditErrors]             = useState<Record<string, string>>({});
  const [editing, setEditing]                   = useState(false);

  if (loans.length === 0) return null;

  async function handleConfirmRelease() {
    if (!confirmTarget || !token) return;
    setConfirming(true);
    try {
      const updated = await apiRequest<ApiLoan>("POST", `loans/${confirmTarget.id}/release`, { token });
      onLoansChanged([updated]);
      toast.success(`Loan ${updated.number} released successfully.`);
      setConfirmTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to release loan.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget || !token) return;
    setCancelling(true);
    try {
      await apiRequest("POST", `loans/${cancelTarget.id}/cancel`, { token });
      onLoansChanged([], cancelTarget.id);
      toast.success(`Pending loan ${cancelTarget.number} cancelled and removed.`);
      setCancelTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel loan.");
    } finally {
      setCancelling(false);
    }
  }

  function openEdit(loan: ApiLoan) {
    setEditTarget(loan);
    setEditLoanType(loan.loan_type as LoanType);
    setEditPrincipal(loan.principal);
    setEditInterest(loan.interest);
    setEditSc(loan.service_charge);
    setEditTermDays(loan.term_days);
    setEditHolidayCount(loan.holiday_count);
    setEditDaily(loan.daily_payment);
    setEditDate(loan.release_date.slice(0, 10));
    setEditRemarks(loan.remarks ?? "");
    setEditErrors({});
  }

  function handleEditPrincipalChange(p: number) {
    setEditPrincipal(p);
    const autoInterest = calcInterest(p, editTermDays);
    setEditInterest(autoInterest);
    setEditDaily(calcDailyPayment(p + autoInterest, editTermDays));
    setEditErrors((e) => ({ ...e, principal: "" }));
  }

  function handleEditTermChange(t: number) {
    setEditTermDays(t);
    const autoInterest = calcInterest(editPrincipal, t);
    setEditInterest(autoInterest);
    setEditDaily(calcDailyPayment(editPrincipal + autoInterest, t));
  }

  async function handleEdit() {
    const errs: Record<string, string> = {};
    if (editPrincipal <= 0) errs.principal = "Principal must be greater than 0.";
    if (editSc < 0)         errs.sc        = "Processing fee cannot be negative.";
    if (editDaily <= 0)     errs.daily     = "Daily payment must be greater than 0.";
    if (!editDate)          errs.date      = "Release date is required.";
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    if (!editTarget || !token) return;
    setEditing(true);
    try {
      const updated = await apiRequest<ApiLoan>("PATCH", `loans/${editTarget.id}/edit-pending`, {
        token,
        body: {
          loan_type:      editLoanType,
          principal:      editPrincipal,
          interest:       editInterest,
          service_charge: editSc,
          daily_payment:  editDaily,
          term_days:      editTermDays,
          holiday_count:  editHolidayCount,
          release_date:   editDate,
          remarks:        editRemarks || null,
        },
      });
      onLoansChanged([updated]);
      toast.success(`Loan ${updated.number} updated.`);
      setEditTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update loan.");
    } finally {
      setEditing(false);
    }
  }

  const editDueDate = editDate
    ? addDays(editDate + "T00:00:00", editTermDays + editHolidayCount)
    : null;

  return (
    <>
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-3 dark:border-amber-900">
          <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Pending Release ({loans.length})
          </h2>
          <p className="ml-2 text-xs text-amber-600 dark:text-amber-500">
            These loans are staged and awaiting confirmation before activation.
          </p>
        </div>

        <div className="divide-y divide-amber-100 dark:divide-amber-900/60">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-sm">{loan.client.name}</span>
                  <span className="text-xs text-muted-foreground">{loan.number}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  <span>Principal: <span className="font-medium text-foreground">{formatPHP(loan.principal)}</span></span>
                  <span>Release: <span className="font-medium text-foreground">{fmtApiDate(loan.release_date)}</span></span>
                  <span>Due: <span className="font-medium text-foreground">{fmtApiDate(loan.due_date)}</span></span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 bg-green-600 text-white hover:bg-green-700"
                  onClick={() => setConfirmTarget(loan)}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Confirm Release
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => openEdit(loan)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setCancelTarget(loan)}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Release dialog */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Loan Release</DialogTitle>
          </DialogHeader>
          {confirmTarget && (
            <div className="space-y-2 text-sm">
              <p>Release this loan to the client?</p>
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{confirmTarget.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-medium">{formatPHP(confirmTarget.principal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Release Date</span>
                  <span className="font-medium">{fmtApiDate(confirmTarget.release_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">{fmtApiDate(confirmTarget.due_date)}</span>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                This will activate the loan and update the client's status.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={confirming}>
              Go Back
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirmRelease}
              disabled={confirming}
            >
              {confirming ? "Releasing…" : "Confirm Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Pending Loan</DialogTitle>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-2 text-sm">
              <p>Permanently delete this pending loan? This cannot be undone.</p>
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{cancelTarget.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan #</span>
                  <span className="font-medium">{cancelTarget.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-medium">{formatPHP(cancelTarget.principal)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Deleting…" : "Cancel Loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit pending loan dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Pending Loan — {editTarget?.number} ({editTarget?.client.name})
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-2">
            {/* Loan type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Loan type</Label>
              <Select value={editLoanType} onValueChange={(v) => setEditLoanType(v as LoanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(LOAN_TYPE_LABELS) as [LoanType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Principal */}
            <div className="space-y-1.5">
              <Label className="text-xs">Principal loan (₱)</Label>
              {editErrors.principal && <p className="text-[11px] text-destructive">{editErrors.principal}</p>}
              <Input
                type="number" min={0}
                value={editPrincipal || ""}
                className={editErrors.principal ? "border-destructive" : ""}
                onChange={(e) => handleEditPrincipalChange(Number(e.target.value) || 0)}
              />
            </div>

            {/* Interest (auto-computed) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Interest (₱) — auto-computed</Label>
              <Input value={formatPHP(editInterest)} readOnly className="bg-muted/40 text-muted-foreground" />
            </div>

            {/* Term */}
            <div className="space-y-1.5">
              <Label className="text-xs">Term of loan</Label>
              <Select value={String(editTermDays)} onValueChange={(v) => handleEditTermChange(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {{ 30: "1 Month", 45: "1.5 Months", 60: "2 Months" }[t] ?? `${t} days`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Holidays */}
            <div className="space-y-1.5">
              <Label className="text-xs">Holidays within term</Label>
              <Select value={String(editHolidayCount)} onValueChange={(v) => setEditHolidayCount(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 0 ? "None" : `${n} holiday${n > 1 ? "s" : ""} (+${n} day${n > 1 ? "s" : ""})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Processing fee */}
            <div className="space-y-1.5">
              <Label className="text-xs">Processing fee (₱)</Label>
              {editErrors.sc && <p className="text-[11px] text-destructive">{editErrors.sc}</p>}
              <Input
                type="number" min={0}
                value={editSc}
                className={editErrors.sc ? "border-destructive" : ""}
                onChange={(e) => { setEditSc(Number(e.target.value) || 0); setEditErrors((e2) => ({ ...e2, sc: "" })); }}
              />
            </div>

            {/* Daily payment */}
            <div className="space-y-1.5">
              <Label className="text-xs">Daily payment (₱)</Label>
              {editErrors.daily && <p className="text-[11px] text-destructive">{editErrors.daily}</p>}
              <Input
                type="number" min={0}
                value={editDaily || ""}
                className={editErrors.daily ? "border-destructive" : ""}
                onChange={(e) => { setEditDaily(Number(e.target.value) || 0); setEditErrors((e2) => ({ ...e2, daily: "" })); }}
              />
            </div>

            {/* Release date */}
            <div className="space-y-1.5">
              <Label className="text-xs">Loan release date</Label>
              {editErrors.date && <p className="text-[11px] text-destructive">{editErrors.date}</p>}
              <DateInput
                value={editDate}
                error={!!editErrors.date}
                onChange={(e) => { setEditDate(e.target.value); setEditErrors((e2) => ({ ...e2, date: "" })); }}
              />
            </div>

            {/* Due date preview */}
            <div className="space-y-1.5">
              <Label className="text-xs">Due date (computed)</Label>
              <Input
                value={editDueDate ? editDueDate.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                readOnly
                className="bg-muted/40 text-muted-foreground"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Remarks (optional)</Label>
              <Textarea
                rows={2}
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Any internal notes…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editing}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
