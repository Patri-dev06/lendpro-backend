import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP } from "@/lib/format";
import { toast } from "sonner";

interface SummaryRow {
  loan_number: string;
  client_name: string;
  daily: number;
  carry_over: number;
  collectible: number;
  balance: number;
  payment: number;
}

interface SummaryResponse {
  date: string;
  rows: SummaryRow[];
  totals: { collectible: number; balance: number; payment: number };
}

interface ApiCollector { id: number; name: string; }

export function CollectorSummaryTab() {
  const { token } = useRole();
  const today = new Date().toISOString().slice(0, 10);

  const [collectors, setCollectors]           = useState<ApiCollector[]>([]);
  const [date, setDate]                       = useState(today);
  const [collectorFilter, setCollectorFilter] = useState("all");
  const [summary, setSummary]                 = useState<SummaryResponse | null>(null);
  const [loading, setLoading]                 = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchCollectors = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiCollector[]>("GET", "collectors", { token });
      setCollectors(data);
    } catch { /* silent — filter just won't populate */ }
  }, [token]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (collectorFilter !== "all") params.set("collector_id", collectorFilter);
      const data = await apiRequest<SummaryResponse>(
        "GET", `payments/collector-summary?${params}`, { token }
      );
      setSummary(data);
    } catch {
      toast.error("Failed to load collection summary.");
    } finally {
      setLoading(false);
    }
  }, [token, date, collectorFilter]);

  useEffect(() => { fetchCollectors(); }, [fetchCollectors]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const collectorName = collectorFilter === "all"
      ? "All Collectors"
      : collectors.find((c) => String(c.id) === collectorFilter)?.name ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Collection Summary — ${date}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:32px;color:#111}
  h2{font-size:18px;margin:0 0 4px}.meta{font-size:11px;color:#666;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}
  th{background:#f0f0f0;font-weight:600;text-align:left;padding:8px 10px;border:1px solid #ccc}
  td{padding:7px 10px;border:1px solid #ddd}.right{text-align:right}
  .total td{font-weight:700;background:#f8f8f8;border-top:2px solid #aaa}
</style></head><body>
<h2>Collection Summary</h2>
<div class="meta">Date: ${date} &nbsp;·&nbsp; ${collectorName}</div>
${content}
</body></html>`);
    win.document.close();
    win.print();
  }

  const rows   = summary?.rows   ?? [];
  const totals = summary?.totals ?? { collectible: 0, balance: 0, payment: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Collector</Label>
          <Select value={collectorFilter} onValueChange={setCollectorFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Collectors</SelectItem>
              {collectors.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="ml-auto" onClick={handlePrint} disabled={loading || rows.length === 0}>
          <Printer className="mr-2 h-4 w-4" />Print Summary
        </Button>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h3 className="font-display text-base font-semibold">Collection Summary</h3>
          <p className="text-xs text-muted-foreground">Daily collection report — {date}</p>
        </div>

        <div ref={printRef} className="overflow-x-auto">
          <Table className="min-w-150">
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead className="text-right">Daily</TableHead>
                <TableHead className="text-right">Missed (Carry-over)</TableHead>
                <TableHead className="text-right">Total Collectible</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No active loans found for this date.
                </td></tr>
              ) : rows.map((r) => (
                <TableRow key={r.loan_number} className={r.carry_over > 0 ? "bg-warning/5" : ""}>
                  <TableCell className="num text-xs text-muted-foreground">{r.loan_number}</TableCell>
                  <TableCell className="font-medium">{r.client_name}</TableCell>
                  <TableCell className="text-right num">{formatPHP(r.daily)}</TableCell>
                  <TableCell className="text-right num">
                    {r.carry_over > 0
                      ? <span className="font-semibold text-warning">+{formatPHP(r.carry_over)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right num font-semibold">{formatPHP(r.collectible)}</TableCell>
                  <TableCell className="text-right num">{formatPHP(r.balance)}</TableCell>
                  <TableCell className="text-right num font-semibold">
                    {r.payment > 0
                      ? formatPHP(r.payment)
                      : <span className="font-normal text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && (
                <TableRow className="border-t-2 bg-muted/40 font-bold">
                  <TableCell colSpan={2} className="text-sm font-semibold">Total</TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right num font-semibold">{formatPHP(totals.collectible)}</TableCell>
                  <TableCell className="text-right num font-semibold">{formatPHP(totals.balance)}</TableCell>
                  <TableCell className="text-right num font-bold text-primary">{formatPHP(totals.payment)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
