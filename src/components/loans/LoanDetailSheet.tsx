import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { DateInput } from "@/components/shared/DateInput";
import { formatPHP, formatDate, addDays } from "@/lib/format";
import { TERM_OPTIONS } from "@/lib/loan-constants";
import { calcInterest, calcDailyPayment } from "@/lib/loan-calc";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { toast } from "sonner";
import type { ApiLoan } from "@/components/loans/LoanCreateSection";

interface Penalty {
  id: number;
  applied_at: string;
  balance_before: number;
  interest_rate: number;
  penalty_rate: number;
  interest_amount: number;
  penalty_amount: number;
  total_added: number;
  balance_after: number;
}

interface Props {
  loan: ApiLoan | null;
  open: boolean;
  onClose: () => void;
  onReconstructed?: (oldLoanId: number, newLoan: ApiLoan) => void;
}

const termLabel = (days: number) =>
  ({ 30: "1 Month", 45: "1.5 Months", 60: "2 Months" } as Record<number, string>)[days] ?? `${days} days`;

export function LoanDetailSheet({ loan, open, onClose, onReconstructed }: Props) {
  const { token, role } = useRole();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading]     = useState(false);

  // Reconstruct dialog state
  const [rcOpen, setRcOpen]               = useState(false);
  const [rcTermDays, setRcTermDays]       = useState(60);
  const [rcHolidayCount, setRcHolidayCount] = useState(0);
  const [rcInterest, setRcInterest]       = useState(0);
  const [rcSc, setRcSc]                   = useState(0);
  const [rcDaily, setRcDaily]             = useState(0);
  const [rcDate, setRcDate]               = useState("");
  const [rcRemarks, setRcRemarks]         = useState("");
  const [rcErrors, setRcErrors]           = useState<Record<string, string>>({});
  const [reconstructing, setReconstructing] = useState(false);

  useEffect(() => {
    if (!open || !loan || !token) return;
    setPenalties([]);
    setLoading(true);
    apiRequest<Penalty[]>("GET", `loans/${loan.id}/penalties`, { token })
      .then(setPenalties)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, loan, token]);

  if (!loan) return null;

  const isPastDue   = ["past-due", "overdue"].includes(loan.status);
  const totalAdded  = penalties.reduce((s, p) => s + p.total_added, 0);
  const paidOff     = loan.total_receivable - loan.current_balance;
  const pctPaid     = loan.total_receivable > 0
    ? Math.min(100, Math.round((paidOff / loan.total_receivable) * 100))
    : 0;

  const canReconstruct =
    (role === "admin" || role === "manager") &&
    (loan.status === "overdue" || loan.status === "past-due");

  function openReconstruct() {
    const p = loan!.current_balance;
    const interest = calcInterest(p, 60);
    setRcTermDays(60);
    setRcHolidayCount(0);
    setRcInterest(interest);
    setRcSc(0);
    setRcDaily(calcDailyPayment(p + interest, 60));
    setRcDate(new Date().toISOString().slice(0, 10));
    setRcRemarks("");
    setRcErrors({});
    setRcOpen(true);
  }

  function handleRcTermChange(t: number) {
    setRcTermDays(t);
    const p = loan!.current_balance;
    const interest = calcInterest(p, t);
    setRcInterest(interest);
    setRcDaily(calcDailyPayment(p + interest, t));
  }

  function handleRcScChange(sc: number) {
    setRcSc(sc);
    const p = loan!.current_balance;
    setRcDaily(calcDailyPayment(p + rcInterest, rcTermDays));
  }

  async function handleReconstruct() {
    const errs: Record<string, string> = {};
    if (rcSc < 0)     errs.sc    = "Cannot be negative.";
    if (rcDaily <= 0) errs.daily = "Must be greater than 0.";
    if (!rcDate)      errs.date  = "Release date is required.";
    if (Object.keys(errs).length > 0) { setRcErrors(errs); return; }
    if (!token) return;
    setReconstructing(true);
    try {
      const newLoan = await apiRequest<ApiLoan>("POST", `loans/${loan!.id}/reconstruct`, {
        token,
        body: {
          interest:       rcInterest,
          service_charge: rcSc,
          daily_payment:  rcDaily,
          term_days:      rcTermDays,
          holiday_count:  rcHolidayCount,
          release_date:   rcDate,
          remarks:        rcRemarks || null,
        },
      });
      toast.success(`Loan reconstructed → ${newLoan.number}`, {
        description: `${loan!.number} marked paid. New ${rcTermDays}-day schedule generated.`,
      });
      setRcOpen(false);
      onReconstructed?.(loan!.id, newLoan);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reconstruct loan.");
    } finally {
      setReconstructing(false);
    }
  }

  const rcPrincipal   = loan.current_balance;
  const rcTotalRec    = rcPrincipal + rcInterest;
  const rcDueDate     = rcDate ? addDays(rcDate + "T00:00:00", rcTermDays + rcHolidayCount) : null;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 font-mono text-base">
              {loan.number}
              <StatusBadge status={loan.status} />
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              {loan.client.name} · {loan.client.store_name}
            </p>
          </SheetHeader>

          {/* Loan summary */}
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm space-y-2 mb-4">
            <Row label="Principal"        value={formatPHP(loan.principal)} />
            <Row label="Processing fee"   value={formatPHP(loan.service_charge)} />
            <Row label="Interest"         value={formatPHP(loan.interest)} />
            <Row label="Total receivable" value={formatPHP(loan.total_receivable)} bold />
            <div className="border-t pt-2 space-y-2">
              <Row label="Paid so far"      value={formatPHP(paidOff)} />
              <Row
                label="Current balance"
                value={formatPHP(loan.current_balance)}
                bold
                highlight={isPastDue}
              />
            </div>
            {/* Progress bar */}
            <div className="pt-1">
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${pctPaid}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{pctPaid}% collected</p>
            </div>
            <div className="border-t pt-2 space-y-2">
              <Row label="Daily payment"  value={formatPHP(loan.daily_payment)} />
              <Row label="Term"           value={`${loan.term_days} days`} />
              <Row label="Release date"   value={formatDate(loan.release_date)} />
              <Row label="Due date"       value={formatDate(loan.due_date)} />
              <Row label="Collector"      value={loan.collector.name} />
            </div>
          </div>

          {/* Reconstruct action */}
          {canReconstruct && (
            <div className="mb-4">
              <Button
                variant="outline"
                className="w-full border-amber-400/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                onClick={openReconstruct}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconstruct Loan
              </Button>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                Restructures this loan using the current balance ({formatPHP(loan.current_balance)}) as the new principal.
              </p>
            </div>
          )}

          {/* Penalty section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Penalty History</h3>
              {penalties.length > 0 && (
                <span className="text-xs text-destructive font-medium">
                  +{formatPHP(totalAdded)} total added
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : penalties.length === 0 ? (
              <div className="rounded-xl border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                {isPastDue
                  ? "No penalties recorded yet."
                  : "No penalties — loan is not past due."}
              </div>
            ) : (
              <>
                {isPastDue && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      8% monthly compound penalty (5% interest + 3% penalty fee) is being applied
                      every 30 days to the outstanding balance.
                    </span>
                  </div>
                )}
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Balance Before</TableHead>
                        <TableHead className="text-right">Interest 5%</TableHead>
                        <TableHead className="text-right">Penalty 3%</TableHead>
                        <TableHead className="text-right">Total Added</TableHead>
                        <TableHead className="text-right">Balance After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {penalties.map((p) => (
                        <TableRow key={p.id} className="text-xs">
                          <TableCell className="whitespace-nowrap">
                            {formatDate(p.applied_at)}
                          </TableCell>
                          <TableCell className="text-right num text-muted-foreground">
                            {formatPHP(p.balance_before)}
                          </TableCell>
                          <TableCell className="text-right num text-orange-600">
                            +{formatPHP(p.interest_amount)}
                          </TableCell>
                          <TableCell className="text-right num text-destructive">
                            +{formatPHP(p.penalty_amount)}
                          </TableCell>
                          <TableCell className="text-right num font-semibold text-destructive">
                            +{formatPHP(p.total_added)}
                          </TableCell>
                          <TableCell className="text-right num font-semibold">
                            {formatPHP(p.balance_after)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Reconstruct Dialog */}
      <Dialog open={rcOpen} onOpenChange={(v) => !v && setRcOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              Reconstruct Loan — {loan.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Info banner */}
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              The current balance of <strong>{formatPHP(loan.current_balance)}</strong> becomes the
              principal of the new loan. The original loan ({loan.number}) will be marked <strong>paid</strong>.
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* New principal (readonly) */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">New principal (current balance)</Label>
                <Input value={formatPHP(rcPrincipal)} readOnly className="bg-muted/40 text-muted-foreground" />
              </div>

              {/* Interest (readonly, auto-computed) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Interest (₱) — auto</Label>
                <Input value={formatPHP(rcInterest)} readOnly className="bg-muted/40 text-muted-foreground" />
              </div>

              {/* Term */}
              <div className="space-y-1.5">
                <Label className="text-xs">Term of loan</Label>
                <Select value={String(rcTermDays)} onValueChange={(v) => handleRcTermChange(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TERM_OPTIONS.map((t) => (
                      <SelectItem key={t} value={String(t)}>{termLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Processing fee */}
              <div className="space-y-1.5">
                <Label className="text-xs">Processing fee (₱)</Label>
                {rcErrors.sc && <p className="text-[11px] text-destructive">{rcErrors.sc}</p>}
                <Input
                  type="number" min={0} value={rcSc}
                  className={rcErrors.sc ? "border-destructive" : ""}
                  onChange={(e) => { handleRcScChange(Number(e.target.value) || 0); setRcErrors((x) => ({ ...x, sc: "" })); }}
                />
              </div>

              {/* Holidays */}
              <div className="space-y-1.5">
                <Label className="text-xs">Holidays within term</Label>
                <Select value={String(rcHolidayCount)} onValueChange={(v) => setRcHolidayCount(Number(v))}>
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

              {/* Daily payment */}
              <div className="space-y-1.5">
                <Label className="text-xs">Daily payment (₱)</Label>
                {rcErrors.daily && <p className="text-[11px] text-destructive">{rcErrors.daily}</p>}
                <Input
                  type="number" min={0} value={rcDaily}
                  className={rcErrors.daily ? "border-destructive" : ""}
                  onChange={(e) => { setRcDaily(Number(e.target.value) || 0); setRcErrors((x) => ({ ...x, daily: "" })); }}
                />
              </div>

              {/* Release date */}
              <div className="space-y-1.5">
                <Label className="text-xs">New release date</Label>
                {rcErrors.date && <p className="text-[11px] text-destructive">{rcErrors.date}</p>}
                <DateInput
                  value={rcDate}
                  error={!!rcErrors.date}
                  onChange={(e) => { setRcDate(e.target.value); setRcErrors((x) => ({ ...x, date: "" })); }}
                />
              </div>

              {/* Due date preview */}
              <div className="space-y-1.5">
                <Label className="text-xs">Due date (computed)</Label>
                <Input value={rcDueDate ? formatDate(rcDueDate) : "—"} readOnly className="bg-muted/40 text-muted-foreground" />
              </div>

              {/* Remarks */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Remarks (optional)</Label>
                <Textarea
                  rows={2}
                  value={rcRemarks}
                  onChange={(e) => setRcRemarks(e.target.value)}
                  placeholder="Notes about this reconstruction…"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">New principal</span>
                <span className="num font-medium">{formatPHP(rcPrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest</span>
                <span className="num font-medium">{formatPHP(rcInterest)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground font-semibold">New total receivable</span>
                <span className="num font-semibold">{formatPHP(rcTotalRec)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily payment</span>
                <span className="num font-medium">{formatPHP(rcDaily)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRcOpen(false)} disabled={reconstructing}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={handleReconstruct}
              disabled={reconstructing}
            >
              {reconstructing ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Reconstructing…</>
              ) : (
                <><RefreshCw className="mr-1.5 h-4 w-4" />Confirm Reconstruct</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({
  label, value, bold, highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num ${bold ? "font-semibold" : ""} ${highlight ? "text-destructive" : ""}`}>
        {value}
      </span>
    </div>
  );
}
