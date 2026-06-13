import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, MapPin, Users, Target, Wallet,
  AlertTriangle, AlertOctagon, TrendingUp, Loader2, CalendarDays, Gauge,
} from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { StatCard } from "@/components/finance/StatCard";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/collectors/$id")({
  component: CollectorDetail,
});

interface ClientLoan {
  id: number; number: string;
  loan_type: string; principal: number;
  total_receivable: number; current_balance: number;
  daily_payment: number; due_date: string; status: string;
}
interface CollectorClient {
  id: number; number: string; name: string;
  store_name: string; phone: string; address: string;
  status: string; loan: ClientLoan | null;
}
interface CollectorDetail {
  id: number; name: string; code: string; area: string;
  assigned: number;
  expected_daily: number; expected_month: number;
  collected_today: number; collected_week: number;
  collected_month: number; collected_year: number;
  overdue: number; past_due: number;
  monthly_collection: Array<{ month: string; collected: string }>;
  clients: CollectorClient[];
}

type Period = "today" | "week" | "month" | "year";
const PERIOD_LABELS: Record<Period, string> = {
  today: "Today", week: "This Week", month: "This Month", year: "This Year",
};

function effRate(collected: number, expected: number) {
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((collected / expected) * 100));
}

function shortMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short" });
}

function CollectorDetail() {
  const { id }      = useParams({ from: "/_app/collectors/$id" });
  const { token }   = useRole();
  const [data, setData]     = useState<CollectorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<CollectorDetail>("GET", `collectors/${id}`, { token });
      setData(res);
    } catch {
      toast.error("Failed to load collector details.");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = data.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const periodCollected: Record<Period, number> = {
    today: data.collected_today,
    week:  data.collected_week,
    month: data.collected_month,
    year:  data.collected_year,
  };
  const periodExpected: Record<Period, number> = {
    today: data.expected_daily,
    week:  data.expected_daily * 6,
    month: data.expected_month,
    year:  data.expected_month * 12,
  };
  const collected = periodCollected[period];
  const expected  = periodExpected[period];
  const rate      = effRate(collected, expected);

  const chartData = data.monthly_collection.map((r) => ({
    month: shortMonth(r.month), collected: Number(r.collected),
  }));

  const dailyEff   = effRate(data.collected_today, data.expected_daily);
  const monthlyEff = effRate(data.collected_month, data.expected_month);
  function effTone(r: number): "success" | "warning" | "destructive" {
    return r >= 80 ? "success" : r >= 50 ? "warning" : "destructive";
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/collectors"><ArrowLeft className="mr-1 h-4 w-4" />Back to collectors</Link>
      </Button>

      <PageHeader title={data.name} subtitle={`${data.code} · ${data.area}`} />

      {/* ── Profile + Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Profile card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display text-lg font-semibold">{data.name}</p>
              <p className="text-xs font-mono text-muted-foreground">{data.code}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />{data.area}
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-border text-sm">
            <InfoRow label="Assigned clients"  value={data.assigned} />
            <InfoRow label="Expected daily"    value={formatPHP(data.expected_daily)} />
            <InfoRow label="Expected monthly"  value={formatPHP(data.expected_month)} />
            <InfoRow label="Overdue accounts"  value={<span className={data.overdue > 0 ? "font-semibold text-warning" : ""}>{data.overdue}</span>} />
            <InfoRow label="Past due accounts" value={<span className={data.past_due > 0 ? "font-semibold text-destructive" : ""}>{data.past_due}</span>} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs">
            {(["today","week","month","year"] as Period[]).map((p) => {
              const r = effRate(periodCollected[p], periodExpected[p]);
              return (
                <div key={p} className="rounded-xl bg-muted/40 p-2.5">
                  <p className="text-muted-foreground capitalize">{PERIOD_LABELS[p]}</p>
                  <p className={`mt-0.5 text-base font-bold num ${r >= 80 ? "text-success" : r >= 50 ? "text-warning" : "text-destructive"}`}>{r}%</p>
                  <p className="text-[10px] text-muted-foreground">{formatPHP(periodCollected[p], { compact: true })}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 content-start">
          <StatCard label="Assigned"          value={String(data.assigned)}                            icon={Users}        hint="total clients" />
          <StatCard label="Expected Daily"    value={formatPHP(data.expected_daily,  { compact: true })} icon={Target}     tone="info"                    hint="active loans" />
          <StatCard label="Expected Monthly"  value={formatPHP(data.expected_month,  { compact: true })} icon={Target}     tone="info"                    hint="active loans" />
          <StatCard label="Daily Efficiency"  value={`${dailyEff}%`}                                   icon={Gauge}        tone={effTone(dailyEff)}        hint="collected vs expected today" />
          <StatCard label="Monthly Efficiency" value={`${monthlyEff}%`}                                icon={Gauge}        tone={effTone(monthlyEff)}      hint="collected vs expected this month" />
          <StatCard label="Collected Today"   value={formatPHP(data.collected_today, { compact: true })} icon={Wallet}     tone="success"                 hint="today" />
          <StatCard label="This Week"         value={formatPHP(data.collected_week,  { compact: true })} icon={CalendarDays} tone="info"                  hint="collected" />
          <StatCard label="This Month"        value={formatPHP(data.collected_month, { compact: true })} icon={TrendingUp}  tone="success"                hint="collected" />
          <StatCard label="This Year"         value={formatPHP(data.collected_year,  { compact: true })} icon={TrendingUp}  tone="success"                hint="collected" />
          <StatCard label="Overdue"           value={String(data.overdue)}                             icon={AlertTriangle} tone="warning"               hint="accounts" />
          <StatCard label="Past Due"          value={String(data.past_due)}                            icon={AlertOctagon}  tone="destructive"           hint="accounts" />
        </div>
      </div>

      {/* ── Period performance ── */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-linear-to-r from-primary/60 to-success/40" />
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Collection Performance</p>
              <p className="text-xs text-muted-foreground mt-0.5">Actual collected vs. expected target</p>
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
            {/* Gauge */}
            <div className="flex items-center gap-6">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={rate >= 80 ? "var(--success)" : rate >= 50 ? "var(--warning)" : "var(--destructive)"}
                    strokeWidth="3"
                    strokeDasharray={`${rate} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold num">{rate}%</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <span className="w-24 text-muted-foreground">Collected</span>
                  <span className="font-semibold num text-success">{formatPHP(collected)}</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-24 text-muted-foreground">Expected</span>
                  <span className="font-semibold num">{formatPHP(expected)}</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-24 text-muted-foreground">Variance</span>
                  <span className={`font-semibold num ${collected >= expected ? "text-success" : "text-destructive"}`}>
                    {collected >= expected ? "+" : ""}{formatPHP(collected - expected)}
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="w-24 text-muted-foreground">Period</span>
                  <span className="font-medium">{PERIOD_LABELS[period]}</span>
                </div>
              </div>
            </div>

            {/* Monthly bar chart */}
            {chartData.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Monthly collection history</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData} barSize={12} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={10} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} width={40} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number) => formatPHP(v)}
                    />
                    <Bar dataKey="collected" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Client accounts ── */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
        <div className="border-b px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">Assigned client accounts</h3>
            <p className="text-xs text-muted-foreground">{data.clients.length} client{data.clients.length !== 1 ? "s" : ""} under this collector</p>
          </div>
        </div>
        <Table className="min-w-225">
          <TableHeader>
            <TableRow>
              <TableHead>Client #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Loan #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Daily</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Loan Status</TableHead>
              <TableHead>Client Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  No clients assigned to this collector.
                </TableCell>
              </TableRow>
            ) : data.clients.map((cl) => (
              <TableRow key={cl.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{cl.number}</TableCell>
                <TableCell className="font-medium">
                  <Link
                    to="/clients/$clientId"
                    params={{ clientId: String(cl.id) }}
                    className="hover:text-primary hover:underline underline-offset-4 transition-colors"
                  >
                    {cl.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{cl.store_name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{cl.loan?.number ?? "—"}</TableCell>
                <TableCell>
                  {cl.loan ? <StatusBadge status={cl.loan.loan_type} /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right num">{cl.loan ? formatPHP(cl.loan.principal) : "—"}</TableCell>
                <TableCell className="text-right num">{cl.loan ? formatPHP(cl.loan.daily_payment) : "—"}</TableCell>
                <TableCell className="text-right num font-semibold">{cl.loan ? formatPHP(cl.loan.current_balance) : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {cl.loan?.due_date ? formatDate(cl.loan.due_date) : "—"}
                </TableCell>
                <TableCell>
                  {cl.loan ? <StatusBadge status={cl.loan.status} /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><StatusBadge status={cl.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium num">{value}</span>
    </div>
  );
}
