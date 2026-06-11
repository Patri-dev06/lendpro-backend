import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileDown, FileText, Loader2, Pencil, Printer, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { DateInput } from "@/components/shared/DateInput";
import { formatPHP, formatDate, addDays } from "@/lib/format";
import { LOAN_TYPE_LABELS, TERM_OPTIONS } from "@/lib/loan-constants";
import { calcInterest, calcDailyPayment } from "@/lib/loan-calc";
import { printLedger, exportLoanLedgerPdf, exportLoanLedgerCsv, type PrintScheduleRow } from "@/lib/loan-prints";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ApiLoan } from "@/components/loans/LoanCreateSection";
import { LoanDetailSheet } from "@/components/loans/LoanDetailSheet";

interface Props {
  loans: ApiLoan[];
  loading: boolean;
  onReconstructed?: (oldLoanId: number, newLoan: ApiLoan) => void;
  onLoanUpdated?: (loan: ApiLoan) => void;
}

export function ActiveLoanTable({ loans, loading, onReconstructed, onLoanUpdated }: Props) {
  const { token, role } = useRole();
  const canEdit = role === "admin" || role === "manager";

  const [q, setQ]               = useState("");
  const [status, setStatus]     = useState("all");
  const [type, setType]         = useState("all");
  const [collector, setCollector] = useState("all");
  const [sortCol, setSortCol]   = useState<SortCol | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [selectedLoan, setSelectedLoan] = useState<ApiLoan | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  // Edit active loan state
  const [editTarget, setEditTarget]             = useState<ApiLoan | null>(null);
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

  function openEdit(loan: ApiLoan) {
    setEditTarget(loan);
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
    const auto = calcInterest(p, editTermDays);
    setEditInterest(auto);
    setEditDaily(calcDailyPayment(p + auto, editTermDays));
    setEditErrors((e) => ({ ...e, principal: "" }));
  }

  function handleEditTermChange(t: number) {
    setEditTermDays(t);
    const auto = calcInterest(editPrincipal, t);
    setEditInterest(auto);
    setEditDaily(calcDailyPayment(editPrincipal + auto, t));
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
      const updated = await apiRequest<ApiLoan>("PATCH", `loans/${editTarget.id}/edit-active`, {
        token,
        body: {
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
      onLoanUpdated?.(updated);
      toast.success(`Loan ${updated.number} updated.`);
      setEditTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update loan.");
    } finally {
      setEditing(false);
    }
  }

  const editDueDate = editDate ? addDays(editDate + "T00:00:00", editTermDays + editHolidayCount) : null;

  async function handlePrint(loan: ApiLoan) {
    setPrintingId(loan.id);
    try {
      const data = await apiRequest<{ schedule: PrintScheduleRow[] }>(
        "GET", `reports/client-ledger?loan_id=${loan.id}`, { token }
      );
      printLedger(loan, data.schedule);
    } catch {
      printLedger(loan);
    } finally {
      setPrintingId(null);
    }
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const collectors = useMemo(() => {
    const seen = new Set<number>();
    return loans
      .map((l) => ({ id: l.collector_id, name: l.collector.name }))
      .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [loans]);

  const filtered = loans.filter((l) => {
    if (status !== "all" && l.status !== status) return false;
    if (type !== "all" && l.loan_type !== type) return false;
    if (collector !== "all" && String(l.collector_id) !== collector) return false;
    const s = q.toLowerCase();
    if (s && !l.number.toLowerCase().includes(s) &&
             !l.client.name.toLowerCase().includes(s) &&
             !l.client.store_name.toLowerCase().includes(s) &&
             !l.collector.name.toLowerCase().includes(s)) return false;
    return true;
  });

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        let cmp = 0;
        if (sortCol === "client_name") {
          cmp = a.client.name.localeCompare(b.client.name);
        } else if (sortCol === "due_date") {
          cmp = a.due_date.localeCompare(b.due_date);
        } else {
          cmp = a[sortCol] - b[sortCol];
        }
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  const activeFilters = [status !== "all", type !== "all", collector !== "all", q !== ""].filter(Boolean).length;

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (status !== "all") parts.push(`Status: ${STATUS_DISPLAY[status] ?? status}`);
    if (type !== "all")   parts.push(`Type: ${LOAN_TYPE_LABELS[type as keyof typeof LOAN_TYPE_LABELS] ?? type}`);
    if (collector !== "all") {
      const c = collectors.find((c) => String(c.id) === collector);
      if (c) parts.push(`Collector: ${c.name}`);
    }
    if (q) parts.push(`Search: "${q}"`);
    return parts.length > 0 ? parts.join(" | ") : "All loans";
  }, [status, type, collector, q, collectors]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setQ(""); setStatus("all"); setType("all"); setCollector("all");
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">

      {/* Header */}
      <div className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Active loan ledger</h3>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${filtered.length} of ${loans.length} loan${loans.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 w-52 pl-8 text-sm" placeholder="Search loans…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button
              variant="outline" size="sm"
              className="h-9 gap-1.5 px-3 text-xs"
              onClick={() => exportLoanLedgerPdf(sorted, filterLabel)}
              disabled={sorted.length === 0}
              title="Export visible rows as PDF"
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button
              variant="outline" size="sm"
              className="h-9 gap-1.5 px-3 text-xs"
              onClick={() => exportLoanLedgerCsv(sorted, filterLabel)}
              disabled={sorted.length === 0}
              title="Export visible rows as CSV"
            >
              <FileDown className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="renew">Renew</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="past-due">Past Due</SelectItem>
              <SelectItem value="paid">Fully Paid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="new-loan">New Loan</SelectItem>
              <SelectItem value="reloan">Reloan</SelectItem>
              <SelectItem value="reconstruct">Reconstruct</SelectItem>
            </SelectContent>
          </Select>
          <Select value={collector} onValueChange={setCollector}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All collectors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collectors</SelectItem>
              {collectors.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={clearFilters}>
              <X className="h-3 w-3" />Clear {activeFilters} filter{activeFilters !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-28">Loan</TableHead>
              <SortHead col="client_name"        label="Client"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <SortHead col="total_receivable"   label="Total"    sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
              <SortHead col="daily_payment"      label="Daily"    sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
              <SortHead col="current_balance"    label="Balance"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
              <TableHead>Status</TableHead>
              <SortHead col="due_date"           label="Due Date" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <TableHead>Collector</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  Loading loans…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  {loans.length === 0 ? "No loans yet. Create one above." : "No loans match your filters."}
                </TableCell>
              </TableRow>
            ) : (<>
              {sorted.map((l) => (
              <TableRow
                key={l.id}
                className={cn(l.status === "paid" && "opacity-55", "cursor-pointer hover:bg-muted/40")}
                onClick={() => setSelectedLoan(l)}
              >

                {/* Loan # + type */}
                <TableCell>
                  <span className="block font-mono text-[11px] text-muted-foreground">{l.number}</span>
                  <span className="mt-0.5 inline-block rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight">
                    {LOAN_TYPE_LABELS[l.loan_type as keyof typeof LOAN_TYPE_LABELS] ?? l.loan_type}
                  </span>
                </TableCell>

                {/* Client */}
                <TableCell>
                  <span className="block font-medium leading-snug">{l.client.name}</span>
                  <span className="block text-xs text-muted-foreground leading-snug">{l.client.store_name}</span>
                </TableCell>

                <TableCell className="text-right num text-sm">{formatPHP(l.total_receivable)}</TableCell>
                <TableCell className="text-right num text-sm text-muted-foreground">{formatPHP(l.daily_payment)}</TableCell>
                <TableCell className="text-right num text-sm font-semibold">{formatPHP(l.current_balance)}</TableCell>
                <TableCell><StatusBadge status={l.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.due_date)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{l.collector.name}</TableCell>

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    {canEdit && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(l)}
                        title="Edit loan"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handlePrint(l)}
                      disabled={printingId === l.id}
                      title="Print ledger"
                    >
                      {printingId === l.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Printer className="h-3.5 w-3.5" />
                      }
                    </Button>
                  </div>
                </TableCell>

              </TableRow>
              ))}
              <TableRow className="border-t-2 bg-muted/40">
                <TableCell colSpan={2} className="py-3 text-xs font-semibold text-muted-foreground">
                  {sorted.length} loan{sorted.length !== 1 ? "s" : ""}
                </TableCell>
                <TableCell className="text-right num text-sm font-bold">{formatPHP(sorted.reduce((s, l) => s + l.total_receivable, 0))}</TableCell>
                <TableCell className="text-right num text-sm font-semibold text-muted-foreground">{formatPHP(sorted.reduce((s, l) => s + l.daily_payment, 0))}</TableCell>
                <TableCell className="text-right num text-sm font-bold">{formatPHP(sorted.reduce((s, l) => s + l.current_balance, 0))}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </>)}
          </TableBody>
        </Table>
      </div>

      <LoanDetailSheet
        loan={selectedLoan}
        open={!!selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onReconstructed={(oldId, newLoan) => {
          setSelectedLoan(null);
          onReconstructed?.(oldId, newLoan);
        }}
      />

      {/* Edit active loan dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Loan — {editTarget?.number} ({editTarget?.client.name})</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-1">
            Corrects loan details and regenerates the collection schedule.
            Current balance is preserved.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-2">
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

            <div className="space-y-1.5">
              <Label className="text-xs">Interest (₱) — auto-computed</Label>
              <Input value={formatPHP(editInterest)} readOnly className="bg-muted/40 text-muted-foreground" />
            </div>

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

            <div className="space-y-1.5">
              <Label className="text-xs">Loan release date</Label>
              {editErrors.date && <p className="text-[11px] text-destructive">{editErrors.date}</p>}
              <DateInput
                value={editDate}
                error={!!editErrors.date}
                onChange={(e) => { setEditDate(e.target.value); setEditErrors((e2) => ({ ...e2, date: "" })); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Due date (computed)</Label>
              <Input
                value={editDueDate ? editDueDate.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                readOnly className="bg-muted/40 text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Remarks (optional)</Label>
              <Textarea
                rows={2}
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Reason for correction…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editing}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SortCol = "total_receivable" | "daily_payment" | "current_balance" | "client_name" | "due_date";

const STATUS_DISPLAY: Record<string, string> = {
  new: "New", renew: "Renew", overdue: "Overdue", "past-due": "Past Due", paid: "Fully Paid",
};

function SortHead({
  col, label, sortCol, sortDir, onSort, align = "left",
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol | null;
  sortDir: "asc" | "desc";
  onSort: (col: SortCol) => void;
  align?: "left" | "right";
}) {
  const active = sortCol === col;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors hover:text-foreground",
          active ? "text-foreground font-semibold" : "text-muted-foreground font-normal",
        )}
      >
        {label}
        <Icon className="h-3 w-3 shrink-0" />
      </button>
    </TableHead>
  );
}
