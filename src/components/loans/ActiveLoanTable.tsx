import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Printer, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { formatPHP, formatDate } from "@/lib/format";
import { LOAN_TYPE_LABELS } from "@/lib/loan-constants";
import { printLedger } from "@/lib/loan-prints";
import { cn } from "@/lib/utils";
import type { ApiLoan } from "@/components/loans/LoanCreateSection";
import { LoanDetailSheet } from "@/components/loans/LoanDetailSheet";

interface Props {
  loans: ApiLoan[];
  loading: boolean;
}

export function ActiveLoanTable({ loans, loading }: Props) {
  const [q, setQ]               = useState("");
  const [status, setStatus]     = useState("all");
  const [type, setType]         = useState("all");
  const [collector, setCollector] = useState("all");
  const [sortCol, setSortCol]   = useState<SortCol | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [selectedLoan, setSelectedLoan] = useState<ApiLoan | null>(null);

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
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 w-52 pl-8 text-sm" placeholder="Search loans…" value={q} onChange={(e) => setQ(e.target.value)} />
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
              <TableHead className="w-9" />
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
            ) : sorted.map((l) => (
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
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => printLedger(l)}
                    title="Print ledger"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LoanDetailSheet
        loan={selectedLoan}
        open={!!selectedLoan}
        onClose={() => setSelectedLoan(null)}
      />
    </div>
  );
}

type SortCol = "total_receivable" | "daily_payment" | "current_balance" | "client_name" | "due_date";

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
