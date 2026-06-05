import { useState } from "react";
import { CalendarClock, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/shared/DateInput";
import { formatPHP, formatDate, addDays } from "@/lib/format";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import type { ApiLoan } from "@/components/loans/LoanCreateSection";

interface Props {
  token: string | null;
  loans: ApiLoan[];
  onLoansChanged: (updated: ApiLoan[], removedId?: number) => void;
}

export function PendingLoansSection({ token, loans, onLoansChanged }: Props) {
  const [rescheduleTarget, setRescheduleTarget] = useState<ApiLoan | null>(null);
  const [newReleaseDate, setNewReleaseDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ApiLoan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ApiLoan | null>(null);
  const [cancelling, setCancelling] = useState(false);

  if (loans.length === 0) return null;

  const previewDueDate = rescheduleTarget && newReleaseDate
    ? addDays(newReleaseDate + "T00:00:00", rescheduleTarget.term_days + rescheduleTarget.holiday_count)
    : null;

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

  async function handleReschedule() {
    if (!rescheduleTarget || !newReleaseDate || !token) return;
    setRescheduling(true);
    try {
      const updated = await apiRequest<ApiLoan>("PATCH", `loans/${rescheduleTarget.id}/reschedule`, {
        token,
        body: { release_date: newReleaseDate },
      });
      onLoansChanged([updated]);
      toast.success(`Loan ${updated.number} rescheduled.`);
      setRescheduleTarget(null);
      setNewReleaseDate("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reschedule loan.");
    } finally {
      setRescheduling(false);
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
                  <span>Release: <span className="font-medium text-foreground">{formatDate(loan.release_date + "T00:00:00")}</span></span>
                  <span>Due: <span className="font-medium text-foreground">{formatDate(loan.due_date + "T00:00:00")}</span></span>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
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
                  onClick={() => {
                    setRescheduleTarget(loan);
                    setNewReleaseDate(loan.release_date);
                  }}
                >
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                  Reschedule
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
                  <span className="font-medium">{formatDate(confirmTarget.release_date + "T00:00:00")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">{formatDate(confirmTarget.due_date + "T00:00:00")}</span>
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

      {/* Reschedule dialog */}
      <Dialog
        open={!!rescheduleTarget}
        onOpenChange={(o) => { if (!o) { setRescheduleTarget(null); setNewReleaseDate(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Release Date</DialogTitle>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{rescheduleTarget.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Release Date</span>
                  <span className="font-medium">{formatDate(rescheduleTarget.release_date + "T00:00:00")}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>New Release Date</Label>
                <DateInput
                  value={newReleaseDate}
                  onChange={(e) => setNewReleaseDate(e.target.value)}
                />
              </div>

              {previewDueDate && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
                  <span className="text-muted-foreground">New Due Date: </span>
                  <span className="font-semibold">
                    {previewDueDate.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRescheduleTarget(null); setNewReleaseDate(""); }}
              disabled={rescheduling}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!newReleaseDate || rescheduling}
            >
              {rescheduling ? "Saving…" : "Save New Date"}
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
    </>
  );
}
