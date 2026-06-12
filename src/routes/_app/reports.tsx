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

  // Reset page when data or category changes
  useEffect(() => { setPage(1); }, [rows, active]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );

  function exportCsv() {
    if (rows.length === 0) return;

    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...cells: (string | number | null | undefined)[]) => cells.map(esc).join(",");

    const lines: string[] = [];

    if (active === "daily-collection") {
      const data = rows as Array<{ payment_date: string; amount: number; new_balance: number; remarks: string | null; client: { name: string }; collector: { name: string } }>;
      lines.push(row("Date", "Client", "Collector", "Amount Paid", "New Balance", "Remarks"));
      for (const p of data)
        lines.push(row(p.payment_date, p.client?.name, p.collector?.name, p.amount, p.new_balance, p.remarks));
    } else if (active === "active-loans" || active === "overdue" || active === "past-due" || active === "paid-loans") {
      const data = rows as Array<{ number: string; principal: number; total_receivable: number; daily_payment: number; current_balance: number; status: string; due_date: string; client: { name: string; store_name: string }; collector: { name: string } }>;
      lines.push(row("Loan #", "Client", "Store", "Collector", "Principal", "Total Receivable", "Daily Payment", "Balance", "Due Date", "Status"));
      for (const l of data)
        lines.push(row(l.number, l.client?.name, l.client?.store_name, l.collector?.name, l.principal, l.total_receivable, l.daily_payment, l.current_balance, l.due_date, l.status));
    } else if (active === "collector-performance") {
      const data = rows as Array<{ name: string; code: string; area: string; assigned: number; expected: number; collected: number; rate: number }>;
      lines.push(row("Collector", "Code", "Area", "Clients", "Expected", "Collected", "Rate (%)"));
      for (const c of data)
        lines.push(row(c.name, c.code, c.area, c.assigned, c.expected, c.collected, c.rate));
    } else if (active === "monthly-collection") {
      const data = rows as Array<{ month: string; collected: number; transactions: number }>;
      lines.push(row("Month", "Total Collected", "Transactions"));
      for (const r of data) lines.push(row(r.month, r.collected, r.transactions));
    } else if (active === "monthly-releases") {
      const data = rows as Array<{ month: string; releases: number; count: number }>;
      lines.push(row("Month", "Total Released", "Loans Released"));
      for (const r of data) lines.push(row(r.month, r.releases, r.count));
    }

    const csv  = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${active}-report.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (rows.length === 0) return;

    const reportLabel = CATEGORIES.find((c) => c.id === active)?.label ?? active;
    const php = (n: number) =>
      "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let thead = "";
    let tbody = "";
    let tfoot = "";

    if (active === "daily-collection") {
      const data = rows as Array<{ payment_date: string; amount: number; new_balance: number; remarks: string | null; client: { name: string }; collector: { name: string } }>;
      const total = data.reduce((s, p) => s + p.amount, 0);
      thead = `<tr><th>Date</th><th>Client</th><th>Collector</th><th class="r">Amount Paid</th><th class="r">New Balance</th><th>Remarks</th></tr>`;
      tbody = data.map((p) => `<tr><td>${p.payment_date}</td><td>${p.client?.name ?? "—"}</td><td>${p.collector?.name ?? "—"}</td><td class="r">${php(p.amount)}</td><td class="r">${php(p.new_balance)}</td><td>${p.remarks ?? "—"}</td></tr>`).join("");
      tfoot = `<tr class="tot"><td colspan="3">${data.length} transaction${data.length !== 1 ? "s" : ""}</td><td class="r">${php(total)}</td><td colspan="2"></td></tr>`;
    } else if (active === "active-loans" || active === "overdue" || active === "past-due" || active === "paid-loans") {
      const data = rows as Array<{ number: string; principal: number; total_receivable: number; daily_payment: number; current_balance: number; status: string; due_date: string; client: { name: string }; collector: { name: string } }>;
      thead = `<tr><th>Loan #</th><th>Client</th><th>Collector</th><th class="r">Principal</th><th class="r">Total Receivable</th><th class="r">Balance</th><th>Due Date</th><th>Status</th></tr>`;
      tbody = data.map((l) => `<tr><td class="mono">${l.number}</td><td>${l.client?.name ?? "—"}</td><td>${l.collector?.name ?? "—"}</td><td class="r">${php(l.principal)}</td><td class="r">${php(l.total_receivable)}</td><td class="r">${php(l.current_balance)}</td><td>${l.due_date ?? "—"}</td><td>${l.status}</td></tr>`).join("");
      tfoot = `<tr class="tot"><td colspan="3">${data.length} loan${data.length !== 1 ? "s" : ""}</td><td class="r">${php(data.reduce((s, l) => s + l.principal, 0))}</td><td class="r">${php(data.reduce((s, l) => s + l.total_receivable, 0))}</td><td class="r">${php(data.reduce((s, l) => s + l.current_balance, 0))}</td><td colspan="2"></td></tr>`;
    } else if (active === "collector-performance") {
      const data = rows as Array<{ name: string; code: string; area: string; assigned: number; expected: number; collected: number; rate: number }>;
      thead = `<tr><th>Collector</th><th>Code</th><th>Area</th><th class="r">Clients</th><th class="r">Expected</th><th class="r">Collected</th><th class="r">Rate</th></tr>`;
      tbody = data.map((c) => `<tr><td>${c.name}</td><td class="mono">${c.code}</td><td>${c.area}</td><td class="r">${c.assigned}</td><td class="r">${php(c.expected)}</td><td class="r">${php(c.collected)}</td><td class="r">${c.rate}%</td></tr>`).join("");
      tfoot = `<tr class="tot"><td colspan="4">${data.length} collector${data.length !== 1 ? "s" : ""}</td><td class="r">${php(data.reduce((s, c) => s + c.expected, 0))}</td><td class="r">${php(data.reduce((s, c) => s + c.collected, 0))}</td><td></td></tr>`;
    } else if (active === "monthly-collection") {
      const data = rows as Array<{ month: string; collected: number; transactions: number }>;
      thead = `<tr><th>Month</th><th class="r">Total Collected</th><th class="r">Transactions</th></tr>`;
      tbody = data.map((r) => `<tr><td>${r.month}</td><td class="r">${php(Number(r.collected))}</td><td class="r">${r.transactions}</td></tr>`).join("");
      tfoot = `<tr class="tot"><td>All months</td><td class="r">${php(data.reduce((s, r) => s + Number(r.collected), 0))}</td><td class="r">${data.reduce((s, r) => s + r.transactions, 0)}</td></tr>`;
    } else if (active === "monthly-releases") {
      const data = rows as Array<{ month: string; releases: number; count: number }>;
      thead = `<tr><th>Month</th><th class="r">Total Released</th><th class="r">Loans Released</th></tr>`;
      tbody = data.map((r) => `<tr><td>${r.month}</td><td class="r">${php(Number(r.releases))}</td><td class="r">${r.count}</td></tr>`).join("");
      tfoot = `<tr class="tot"><td>All months</td><td class="r">${php(data.reduce((s, r) => s + Number(r.releases), 0))}</td><td class="r">${data.reduce((s, r) => s + r.count, 0)}</td></tr>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${reportLabel}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}h2{font-size:15px;margin-bottom:4px}p.sub{font-size:10px;color:#666;margin-bottom:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f2f2f2;font-weight:600}.r{text-align:right}.mono{font-family:monospace;font-size:10px}tr.tot td{background:#f5f5f5;font-weight:700;border-top:2px solid #888}@media print{body{padding:0}}</style>
</head><body>
<h2>${reportLabel}</h2>
<p class="sub">Generated: ${new Date().toLocaleString("en-PH")}</p>
<table><thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot></table>
</body></html>`;

    const w = window.open("", "_blank", "width=960,height=720");
    if (!w) { toast.error("Popup blocked. Allow popups for this site and try again."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold num">{value}</p>
    </div>
  );
}
