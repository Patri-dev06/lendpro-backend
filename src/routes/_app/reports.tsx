import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/shared/AccessRestricted";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — BuenaMano" }] }),
  component: ReportsPage,
});

type Category =
  | "daily-collection"
  | "active-loans"
  | "paid-loans"
  | "overdue"
  | "past-due"
  | "collector-performance"
  | "monthly-collection"
  | "monthly-releases";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "daily-collection",       label: "Daily Collection Report" },
  { id: "active-loans",           label: "Active Loans Report" },
  { id: "paid-loans",             label: "Fully Paid Loans" },
  { id: "overdue",                label: "Overdue +3 Days" },
  { id: "past-due",               label: "Past Due +30 Days" },
  { id: "collector-performance",  label: "Collector Performance" },
  { id: "monthly-collection",     label: "Monthly Collection" },
  { id: "monthly-releases",       label: "Monthly Releases" },
];

interface ApiCollector { id: number; name: string; }

function ReportsPage() {
  const { token } = useRole();
  const [active, setActive]         = useState<Category>("daily-collection");
  const [collectors, setCollectors] = useState<ApiCollector[]>([]);

  // Filters
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const [fromDate, setFromDate]     = useState(today);
  const [toDate, setToDate]         = useState(today);
  const [month, setMonth]           = useState(thisMonth);
  const [collectorId, setCollectorId] = useState("all");

  // Results
  const [rows, setRows]       = useState<unknown[]>([]);
  const [summary, setSummary] = useState({ expected: 0, collected: 0, balance: 0, count: 0 });
  const [loading, setLoading] = useState(false);
  const fetchSeq = useRef(0);

  const fetchCollectors = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiCollector[]>("GET", "collectors", { token });
      setCollectors(data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { fetchCollectors(); }, [fetchCollectors]);

  const fetchReport = useCallback(async () => {
    if (!token) return;
    const seq = ++fetchSeq.current;
    setLoading(true);
    setRows([]);
    setSummary({ expected: 0, collected: 0, balance: 0, count: 0 });
    try {
      let nextRows: unknown[] = [];
      let nextSummary = { expected: 0, collected: 0, balance: 0, count: 0 };

      if (active === "daily-collection") {
        const params = new URLSearchParams();
        if (fromDate) params.set("date", fromDate);
        if (collectorId !== "all") params.set("collector_id", collectorId);
        const data = await apiRequest<unknown[]>("GET", `payments?${params}`, { token });
        const arr = data as Array<{ amount: number; new_balance: number }>;
        nextRows = data;
        nextSummary = { expected: 0, collected: arr.reduce((s, p) => s + p.amount, 0), balance: 0, count: arr.length };

      } else if (active === "active-loans" || active === "overdue" || active === "past-due" || active === "paid-loans") {
        const statusMap: Record<string, string> = {
          "active-loans": "", "overdue": "overdue", "past-due": "past-due", "paid-loans": "paid",
        };
        const params = new URLSearchParams();
        const s = statusMap[active];
        if (s) params.set("status", s);
        if (collectorId !== "all") params.set("collector_id", collectorId);
        const data = await apiRequest<unknown[]>("GET", `loans?${params}`, { token });
        const loans = data as Array<{ status: string; daily_payment: number; current_balance: number; total_receivable: number }>;
        const filtered = active === "active-loans" ? loans.filter((l) => l.status !== "paid") : loans;
        nextRows = filtered;
        nextSummary = {
          expected:  filtered.reduce((s, l) => s + l.daily_payment, 0),
          collected: filtered.reduce((s, l) => s + (l.total_receivable - l.current_balance), 0),
          balance:   filtered.reduce((s, l) => s + l.current_balance, 0),
          count:     filtered.length,
        };

      } else if (active === "collector-performance") {
        const data = await apiRequest<{ collectors: unknown[] }>("GET", `reports/collector-summary?month=${month}`, { token });
        const arr = data.collectors as Array<{ expected: number; collected: number }>;
        nextRows = data.collectors;
        nextSummary = { expected: arr.reduce((s, c) => s + c.expected, 0), collected: arr.reduce((s, c) => s + c.collected, 0), balance: 0, count: arr.length };

      } else if (active === "monthly-collection") {
        const data = await apiRequest<unknown[]>("GET", "reports/monthly-collection", { token });
        const arr = data as Array<{ collected: number; transactions: number }>;
        nextRows = data;
        nextSummary = { expected: 0, collected: arr.reduce((s, r) => s + Number(r.collected), 0), balance: 0, count: arr.reduce((s, r) => s + r.transactions, 0) };

      } else if (active === "monthly-releases") {
        const data = await apiRequest<unknown[]>("GET", "reports/monthly-releases", { token });
        const arr = data as Array<{ releases: number; count: number }>;
        nextRows = data;
        nextSummary = { expected: 0, collected: arr.reduce((s, r) => s + Number(r.releases), 0), balance: 0, count: arr.reduce((s, r) => s + r.count, 0) };
      }

      if (seq !== fetchSeq.current) return;
      setRows(nextRows);
      setSummary(nextSummary);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [token, active, fromDate, toDate, month, collectorId]);

  // Auto-fetch on category change
  useEffect(() => { fetchReport(); }, [fetchReport]);

  function exportCsv() {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0] as object);
    const header = keys.join(",");
    const body = (rows as Record<string, unknown>[]).map((r) =>
      keys.map((k) => JSON.stringify(r[k] ?? "")).join(",")
    ).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${active}-report.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PermissionGuard permission="reports:read">
    <div className="space-y-6">
      <PageHeader title="Report center" subtitle="Generate, preview and export operational reports." />

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CATEGORIES.map((c) => {
          const isActive = active === c.id;
          return (
            <button key={c.id} onClick={() => { setRows([]); setSummary({ expected: 0, collected: 0, balance: 0, count: 0 }); setLoading(true); setActive(c.id); }}
              className={cn(
                "rounded-2xl border p-4 text-left text-sm shadow-sm transition-all duration-150 cursor-pointer select-none",
                isActive
                  ? "bg-primary border-primary text-primary-foreground shadow-md"
                  : "bg-card hover:bg-muted/60 hover:-translate-y-px hover:shadow-md"
              )}>
              <FileText className={cn("h-5 w-5", isActive ? "text-primary-foreground/80" : "text-primary")} />
              <p className="mt-2 font-medium leading-tight">{c.label}</p>
              <p className={cn("mt-1 text-xs", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                Tap to preview
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-5">
          <div>
            <h3 className="font-display text-base font-semibold">{CATEGORIES.find((c) => c.id === active)?.label}</h3>
            <p className="text-xs text-muted-foreground">Filter, then export.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Date filter — daily reports */}
            {(active === "daily-collection") && (
              <Input type="date" className="h-9 w-36" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            )}
            {/* Date range — loan reports */}
            {(active === "active-loans" || active === "overdue" || active === "past-due" || active === "paid-loans") && (
              <>
                <Input type="date" className="h-9 w-36" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" />
                <Input type="date" className="h-9 w-36" value={toDate}   onChange={(e) => setToDate(e.target.value)}   placeholder="To" />
              </>
            )}
            {/* Month picker */}
            {(active === "collector-performance" || active === "monthly-collection" || active === "monthly-releases") && (
              <Input type="month" className="h-9 w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
            )}
            {/* Collector filter */}
            {(active === "daily-collection" || active === "active-loans" || active === "overdue" || active === "past-due") && (
              <Select value={collectorId} onValueChange={setCollectorId}>
                <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Collector" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All collectors</SelectItem>
                  {collectors.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={fetchReport} disabled={loading} className="h-9 bg-primary text-primary-foreground hover:bg-primary-glow">
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
          {active === "daily-collection" && <>
            <Summary label="Total collected"  value={formatPHP(summary.collected)} />
            <Summary label="Transactions"     value={String(summary.count)} />
          </>}
          {(active === "active-loans" || active === "overdue" || active === "past-due" || active === "paid-loans") && <>
            <Summary label="Daily expected"       value={formatPHP(summary.expected)} />
            <Summary label="Total collected"      value={formatPHP(summary.collected)} />
            <Summary label="Outstanding balance"  value={formatPHP(summary.balance)} />
            <Summary label="Accounts in report"   value={String(summary.count)} />
          </>}
          {active === "collector-performance" && <>
            <Summary label="Total expected"   value={formatPHP(summary.expected)} />
            <Summary label="Total collected"  value={formatPHP(summary.collected)} />
            <Summary label="Collectors"       value={String(summary.count)} />
          </>}
          {(active === "monthly-collection" || active === "monthly-releases") && <>
            <Summary label={active === "monthly-collection" ? "Total collected" : "Total released"}
                     value={formatPHP(summary.collected)} />
            <Summary label="Total transactions" value={String(summary.count)} />
          </>}
        </div>

        {/* Data table */}
        <div className="overflow-x-auto px-5 pb-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No data found for the selected filters.
            </div>
          ) : (
            <ReportTable category={active} rows={rows} />
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />Print
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />Export PDF
          </Button>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}

/* ---- Per-category table renderer ---- */
function ReportTable({ category, rows }: { category: Category; rows: unknown[] }) {
  if (category === "daily-collection") {
    const data = rows as Array<{ id: number; payment_date: string; amount: number; previous_balance: number; new_balance: number; remarks: string | null; client: { name: string }; collector: { name: string }; loan?: { number: string } }>;
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Collector</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">New Balance</TableHead>
          <TableHead>Remarks</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{formatDate(p.payment_date)}</TableCell>
              <TableCell className="font-medium">{p.client?.name ?? "—"}</TableCell>
              <TableCell>{p.collector?.name ?? "—"}</TableCell>
              <TableCell className="text-right num font-medium">{formatPHP(p.amount)}</TableCell>
              <TableCell className="text-right num">{formatPHP(p.new_balance)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.remarks ?? "—"}</TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 bg-muted/40">
            <TableCell colSpan={3} className="py-3 font-semibold text-sm">{data.length} transaction{data.length !== 1 ? "s" : ""}</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, p) => s + p.amount, 0))}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  if (category === "active-loans" || category === "overdue" || category === "past-due" || category === "paid-loans") {
    const data = rows as Array<{ id: number; number: string; loan_type: string; principal: number; total_receivable: number; daily_payment: number; current_balance: number; status: string; due_date: string; client: { name: string; store_name: string }; collector: { name: string } }>;
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>Loan #</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Collector</TableHead>
          <TableHead className="text-right">Principal</TableHead>
          <TableHead className="text-right">Total Receivable</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-mono text-xs">{l.number}</TableCell>
              <TableCell className="font-medium">{l.client?.name ?? "—"}</TableCell>
              <TableCell>{l.collector?.name ?? "—"}</TableCell>
              <TableCell className="text-right num">{formatPHP(l.principal)}</TableCell>
              <TableCell className="text-right num">{formatPHP(l.total_receivable)}</TableCell>
              <TableCell className="text-right num">{formatPHP(l.current_balance)}</TableCell>
              <TableCell className="text-sm">{formatDate(l.due_date)}</TableCell>
              <TableCell><span className="rounded-full border px-2 py-0.5 text-xs capitalize">{l.status}</span></TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 bg-muted/40">
            <TableCell colSpan={3} className="py-3 font-semibold text-sm">{data.length} loan{data.length !== 1 ? "s" : ""}</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, l) => s + l.principal, 0))}</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, l) => s + l.total_receivable, 0))}</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, l) => s + l.current_balance, 0))}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  if (category === "collector-performance") {
    const data = rows as Array<{ id: number; name: string; code: string; area: string; assigned: number; expected: number; collected: number; rate: number }>;
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>Collector</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Area</TableHead>
          <TableHead className="text-right">Clients</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Collected</TableHead>
          <TableHead className="text-right">Collection Rate</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="font-mono text-xs">{c.code}</TableCell>
              <TableCell>{c.area}</TableCell>
              <TableCell className="text-right">{c.assigned}</TableCell>
              <TableCell className="text-right num">{formatPHP(c.expected)}</TableCell>
              <TableCell className="text-right num">{formatPHP(c.collected)}</TableCell>
              <TableCell className="text-right">
                <span className={`font-semibold ${c.rate >= 80 ? "text-success" : c.rate >= 50 ? "text-amber-600" : "text-destructive"}`}>
                  {c.rate}%
                </span>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 bg-muted/40">
            <TableCell colSpan={4} className="py-3 font-semibold text-sm">{data.length} collector{data.length !== 1 ? "s" : ""}</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, c) => s + c.expected, 0))}</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, c) => s + c.collected, 0))}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  if (category === "monthly-collection") {
    const data = rows as Array<{ month: string; collected: number; transactions: number }>;
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Total Collected</TableHead>
          <TableHead className="text-right">Transactions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.month}>
              <TableCell className="font-medium">{r.month}</TableCell>
              <TableCell className="text-right num font-semibold">{formatPHP(Number(r.collected))}</TableCell>
              <TableCell className="text-right">{r.transactions}</TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 bg-muted/40">
            <TableCell className="py-3 font-semibold text-sm">All months</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, r) => s + Number(r.collected), 0))}</TableCell>
            <TableCell className="text-right font-bold">{data.reduce((s, r) => s + r.transactions, 0)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  if (category === "monthly-releases") {
    const data = rows as Array<{ month: string; releases: number; count: number }>;
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Total Released</TableHead>
          <TableHead className="text-right">Loans Released</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.month}>
              <TableCell className="font-medium">{r.month}</TableCell>
              <TableCell className="text-right num font-semibold">{formatPHP(Number(r.releases))}</TableCell>
              <TableCell className="text-right">{r.count}</TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 bg-muted/40">
            <TableCell className="py-3 font-semibold text-sm">All months</TableCell>
            <TableCell className="text-right num font-bold">{formatPHP(data.reduce((s, r) => s + Number(r.releases), 0))}</TableCell>
            <TableCell className="text-right font-bold">{data.reduce((s, r) => s + r.count, 0)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return null;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold num">{value}</p>
    </div>
  );
}
