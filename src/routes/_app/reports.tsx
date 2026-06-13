import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { CalendarCheck, Download, FileSpreadsheet, FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { CollectionScheduleSection } from "@/components/reports/CollectionScheduleSection";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP, formatDate } from "@/lib/format";
import { downloadCsv, downloadTablePdf, exportDate, type PdfTableColumn } from "@/lib/export";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Paginator } from "@/components/shared/Paginator";
import { PermissionGuard } from "@/components/shared/AccessRestricted";

const PAGE_SIZE = 25;

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
  | "monthly-releases"
  | "collection-schedule";

const CATEGORIES: { id: Category; label: string; icon?: React.ElementType }[] = [
  { id: "daily-collection",       label: "Daily Collection Report" },
  { id: "active-loans",           label: "Active Loans Report" },
  { id: "paid-loans",             label: "Fully Paid Loans" },
  { id: "overdue",                label: "Overdue +3 Days" },
  { id: "past-due",               label: "Past Due +30 Days" },
  { id: "collector-performance",  label: "Collector Performance" },
  { id: "monthly-collection",     label: "Monthly Collection" },
  { id: "monthly-releases",       label: "Monthly Releases" },
  { id: "collection-schedule",    label: "Collection Schedule", icon: CalendarCheck },
];

interface ApiCollector { id: number; name: string; }

function ReportsPage() {
  const { token } = useRole();
  const [active, setActive]         = useState<Category>("daily-collection");
  const [collectors, setCollectors] = useState<ApiCollector[]>([]);

  // Filters — every card uses a from/to date range (blank = all dates).
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");
  const [collectorId, setCollectorId] = useState("all");

  // Results
  const [rows, setRows]       = useState<unknown[]>([]);
  const [summary, setSummary] = useState({ expected: 0, collected: 0, balance: 0, count: 0 });
  const [loading, setLoading] = useState(false);
  const fetchSeq = useRef(0);
  const [page, setPage]       = useState(1);

  const fetchCollectors = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiCollector[]>("GET", "collectors", { token });
      setCollectors(data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { fetchCollectors(); }, [fetchCollectors]);

  const fetchReport = useCallback(async () => {
    if (!token || active === "collection-schedule") return;
    const seq = ++fetchSeq.current;
    setLoading(true);
    setRows([]);
    setSummary({ expected: 0, collected: 0, balance: 0, count: 0 });
    try {
      let nextRows: unknown[] = [];
      let nextSummary = { expected: 0, collected: 0, balance: 0, count: 0 };

      if (active === "daily-collection") {
        const params = new URLSearchParams();
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
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
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
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
        const params = new URLSearchParams();
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        const data = await apiRequest<{ collectors: unknown[] }>("GET", `reports/collector-summary?${params}`, { token });
        const arr = data.collectors as Array<{ expected: number; collected: number }>;
        nextRows = data.collectors;
        nextSummary = { expected: arr.reduce((s, c) => s + c.expected, 0), collected: arr.reduce((s, c) => s + c.collected, 0), balance: 0, count: arr.length };

      } else if (active === "monthly-collection") {
        const params = new URLSearchParams();
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        const data = await apiRequest<unknown[]>("GET", `reports/monthly-collection?${params}`, { token });
        const arr = data as Array<{ collected: number; transactions: number }>;
        nextRows = data;
        nextSummary = { expected: 0, collected: arr.reduce((s, r) => s + Number(r.collected), 0), balance: 0, count: arr.reduce((s, r) => s + r.transactions, 0) };

      } else if (active === "monthly-releases") {
        const params = new URLSearchParams();
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        const data = await apiRequest<unknown[]>("GET", `reports/monthly-releases?${params}`, { token });
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
  }, [token, active, fromDate, toDate, collectorId]);

  // Auto-fetch on category change
  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Reset page when data or category changes
  useEffect(() => { setPage(1); }, [rows, active]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );

  const rangeLabel =
    fromDate && toDate ? `${fromDate} to ${toDate}`
    : fromDate         ? `From ${fromDate}`
    : toDate           ? `Until ${toDate}`
    : "All dates";

  function exportCsv() {
    if (rows.length === 0) return;
    const ex = buildReportExport(active, rows);
    if (!ex) return;
    downloadCsv(`${active}-report-${exportDate()}`, ex.columns.map((c) => c.header), [...ex.csvRows, ex.csvTotal]);
  }

  function exportPdf() {
    if (rows.length === 0) return;
    const ex = buildReportExport(active, rows);
    if (!ex) return;
    downloadTablePdf({
      title: CATEGORIES.find((c) => c.id === active)?.label ?? active,
      subtitle: rangeLabel,
      columns: ex.columns,
      rows: ex.pdfRows,
      totalRow: ex.pdfTotal,
      onPopupBlocked: () => toast.error("Popup blocked. Allow popups for this site and try again."),
    });
  }

  return (
    <PermissionGuard permission="reports:read">
    <div className="space-y-6">
      <PageHeader title="Report center" subtitle="Generate, preview and export operational reports." />

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CATEGORIES.map((c) => {
          const isActive = active === c.id;
          const Icon = c.icon ?? FileText;
          return (
            <button key={c.id} onClick={() => { setRows([]); setSummary({ expected: 0, collected: 0, balance: 0, count: 0 }); setLoading(true); setActive(c.id); }}
              className={cn(
                "rounded-2xl border p-4 text-left text-sm shadow-sm transition-all duration-150 cursor-pointer select-none",
                isActive
                  ? "bg-primary border-primary text-primary-foreground shadow-md"
                  : "bg-card hover:bg-muted/60 hover:-translate-y-px hover:shadow-md"
              )}>
              <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground/80" : "text-primary")} />
              <p className="mt-2 font-medium leading-tight">{c.label}</p>
              <p className={cn("mt-1 text-xs", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                Tap to preview
              </p>
            </button>
          );
        })}
      </div>

      {active === "collection-schedule" ? (
        <CollectionScheduleSection />
      ) : (
      <div className="rounded-2xl border bg-card shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-5">
          <div>
            <h3 className="font-display text-base font-semibold">{CATEGORIES.find((c) => c.id === active)?.label}</h3>
            <p className="text-xs text-muted-foreground">Filter, then export.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {/* Date range — every card; blank means all dates */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">From</p>
              <Input type="date" className="h-9 w-36" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">To</p>
              <Input type="date" className="h-9 w-36" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
            </div>
            {/* Collector filter */}
            {(active === "daily-collection" || active === "active-loans" || active === "overdue" || active === "past-due" || active === "paid-loans") && (
              <SearchableCombobox
                className="h-9 w-44"
                options={[
                  { value: "all", label: "All collectors" },
                  ...collectors.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
                value={collectorId}
                onChange={setCollectorId}
                placeholder="Collector…"
              />
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
            <ReportTable category={active} rows={pagedRows} />
          )}
        </div>

        <Paginator page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={rows.length === 0}>
            <Printer className="mr-1.5 h-4 w-4" />Print
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />Export PDF
          </Button>
        </div>
      </div>
      )}
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

/* ---- Per-category export model: same columns as the table, with a Total row ---- */
interface ReportExportData {
  columns: PdfTableColumn[];
  csvRows: (string | number)[][];
  csvTotal: (string | number)[];
  pdfRows: (string | number)[][];
  pdfTotal: (string | number)[];
}

function buildReportExport(category: Category, rows: unknown[]): ReportExportData | null {
  const php = (n: number) => formatPHP(n);
  const n2  = (n: number) => n.toFixed(2);

  if (category === "daily-collection") {
    const data = rows as Array<{ payment_date: string; amount: number; new_balance: number; remarks: string | null; client: { name: string }; collector: { name: string } }>;
    const amount = data.reduce((s, p) => s + p.amount, 0);
    const newBal = data.reduce((s, p) => s + p.new_balance, 0);
    return {
      columns: [
        { header: "Date" }, { header: "Client" }, { header: "Collector" },
        { header: "Amount", align: "right" }, { header: "New Balance", align: "right" }, { header: "Remarks" },
      ],
      csvRows:  data.map((p) => [formatDate(p.payment_date), p.client?.name ?? "", p.collector?.name ?? "", n2(p.amount), n2(p.new_balance), p.remarks ?? ""]),
      csvTotal: ["Total", `${data.length} transactions`, "", n2(amount), n2(newBal), ""],
      pdfRows:  data.map((p) => [formatDate(p.payment_date), p.client?.name ?? "—", p.collector?.name ?? "—", php(p.amount), php(p.new_balance), p.remarks ?? "—"]),
      pdfTotal: ["Total", `${data.length} transactions`, "", php(amount), php(newBal), ""],
    };
  }

  if (category === "active-loans" || category === "overdue" || category === "past-due" || category === "paid-loans") {
    const data = rows as Array<{ number: string; principal: number; total_receivable: number; current_balance: number; status: string; due_date: string; client: { name: string }; collector: { name: string } }>;
    const principal  = data.reduce((s, l) => s + l.principal, 0);
    const receivable = data.reduce((s, l) => s + l.total_receivable, 0);
    const balance    = data.reduce((s, l) => s + l.current_balance, 0);
    return {
      columns: [
        { header: "Loan #" }, { header: "Client" }, { header: "Collector" },
        { header: "Principal", align: "right" }, { header: "Total Receivable", align: "right" }, { header: "Balance", align: "right" },
        { header: "Due Date" }, { header: "Status" },
      ],
      csvRows:  data.map((l) => [l.number, l.client?.name ?? "", l.collector?.name ?? "", n2(l.principal), n2(l.total_receivable), n2(l.current_balance), formatDate(l.due_date), l.status]),
      csvTotal: ["Total", `${data.length} loans`, "", n2(principal), n2(receivable), n2(balance), "", ""],
      pdfRows:  data.map((l) => [l.number, l.client?.name ?? "—", l.collector?.name ?? "—", php(l.principal), php(l.total_receivable), php(l.current_balance), formatDate(l.due_date), l.status]),
      pdfTotal: ["Total", `${data.length} loans`, "", php(principal), php(receivable), php(balance), "", ""],
    };
  }

  if (category === "collector-performance") {
    const data = rows as Array<{ name: string; code: string; area: string; assigned: number; expected: number; collected: number; rate: number }>;
    const clients   = data.reduce((s, c) => s + c.assigned, 0);
    const expected  = data.reduce((s, c) => s + c.expected, 0);
    const collected = data.reduce((s, c) => s + c.collected, 0);
    const overall   = expected > 0 ? `${Math.round((collected / expected) * 1000) / 10}%` : "0%";
    return {
      columns: [
        { header: "Collector" }, { header: "Code" }, { header: "Area" },
        { header: "Clients", align: "right" }, { header: "Expected", align: "right" }, { header: "Collected", align: "right" }, { header: "Collection Rate", align: "right" },
      ],
      csvRows:  data.map((c) => [c.name, c.code, c.area, c.assigned, n2(c.expected), n2(c.collected), `${c.rate}%`]),
      csvTotal: ["Total", "", `${data.length} collectors`, clients, n2(expected), n2(collected), overall],
      pdfRows:  data.map((c) => [c.name, c.code, c.area, String(c.assigned), php(c.expected), php(c.collected), `${c.rate}%`]),
      pdfTotal: ["Total", "", `${data.length} collectors`, String(clients), php(expected), php(collected), overall],
    };
  }

  if (category === "monthly-collection") {
    const data = rows as Array<{ month: string; collected: number; transactions: number }>;
    const collected = data.reduce((s, r) => s + Number(r.collected), 0);
    const tx        = data.reduce((s, r) => s + r.transactions, 0);
    return {
      columns:  [{ header: "Month" }, { header: "Total Collected", align: "right" }, { header: "Transactions", align: "right" }],
      csvRows:  data.map((r) => [r.month, n2(Number(r.collected)), r.transactions]),
      csvTotal: ["Total", n2(collected), tx],
      pdfRows:  data.map((r) => [r.month, php(Number(r.collected)), String(r.transactions)]),
      pdfTotal: ["Total", php(collected), String(tx)],
    };
  }

  if (category === "monthly-releases") {
    const data = rows as Array<{ month: string; releases: number; count: number }>;
    const releases = data.reduce((s, r) => s + Number(r.releases), 0);
    const count    = data.reduce((s, r) => s + r.count, 0);
    return {
      columns:  [{ header: "Month" }, { header: "Total Released", align: "right" }, { header: "Loans Released", align: "right" }],
      csvRows:  data.map((r) => [r.month, n2(Number(r.releases)), r.count]),
      csvTotal: ["Total", n2(releases), count],
      pdfRows:  data.map((r) => [r.month, php(Number(r.releases)), String(r.count)]),
      pdfTotal: ["Total", php(releases), String(count)],
    };
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
