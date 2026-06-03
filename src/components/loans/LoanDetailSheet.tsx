import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { formatPHP, formatDate } from "@/lib/format";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
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
}

export function LoanDetailSheet({ loan, open, onClose }: Props) {
  const { token } = useRole();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading]     = useState(false);

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

  return (
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
