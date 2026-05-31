import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Banknote, TrendingUp, Wallet, Activity, Target, AlertTriangle, AlertOctagon, Loader2, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, exportDate } from "@/lib/export";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { StatCard } from "@/components/finance/StatCard";
import { PageHeader } from "@/components/finance/PageHeader";
import { CollectionEfficiencyBanner } from "@/components/dashboard/CollectionEfficiencyBanner";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { RiskCard } from "@/components/dashboard/RiskCard";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP } from "@/lib/format";
import { tokenColors, tooltipStyle } from "@/components/dashboard/dashboardConstants";

interface CollectorStat {
  id: number;
  name: string;
  code: string;
  area: string;
  assigned: number;
  expected: number;
  actual: number;
  missed: number;
  overdue: number;
  past_due: number;
}

interface DashboardStats {
  counts: { active: number; new: number; renew: number; overdue: number; past_due: number; paid: number };
  financials: { total_receivable: number; total_outstanding: number; total_collected: number; collection_efficiency: number };
  monthly_releases: Array<{ month: string; releases: string }>;
  monthly_collection: Array<{ month: string; collected: string }>;
  collector_stats: CollectorStat[];
  loans: unknown[];
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short" });
}

export function ManagerDashboard() {
  const { token } = useRole();
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<DashboardStats>("GET", "dashboard/stats", { token });
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading || !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { counts, financials } = stats;

  const monthlyCollection = stats.monthly_collection.map((r) => ({
    month: shortMonth(r.month),
    collected: Number(r.collected),
  }));

  const normalActive = counts.active - counts.overdue - counts.past_due;
  const donut = [
    { name: "Active",      value: Math.max(0, normalActive), color: tokenColors.primary },
    { name: "Overdue",     value: counts.overdue,            color: tokenColors.warning },
    { name: "Past Due",    value: counts.past_due,           color: tokenColors.destructive },
    { name: "Fully Paid",  value: counts.paid,               color: tokenColors.success },
  ];

  const collectorChartData = stats.collector_stats.map((c) => ({
    name:     c.name.split(" ")[0],
    expected: c.expected,
    actual:   c.actual,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        subtitle="Portfolio performance and collection effectiveness"
        actions={
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary-glow">
            <Link to="/loans" search={{ clientId: undefined }}><Plus className="mr-1.5 h-4 w-4" />Create new loan</Link>
          </Button>
        }
      />
      <CollectionEfficiencyBanner
        rate={financials.collection_efficiency}
        collected={financials.total_collected}
        receivable={financials.total_receivable}
      />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => downloadCsv(`portfolio-summary-${exportDate()}`,
          ["Metric", "Value"],
          [
            ["Active Loans",            counts.active],
            ["Overdue Accounts",        counts.overdue],
            ["Past Due Accounts",       counts.past_due],
            ["Paid Loans",              counts.paid],
            ["Total Receivable (PHP)",  financials.total_receivable],
            ["Total Collected (PHP)",   financials.total_collected],
            ["Total Outstanding (PHP)", financials.total_outstanding],
            ["Collection Efficiency (%)", financials.collection_efficiency],
          ])}>
          <Download className="h-3.5 w-3.5" />Export Portfolio Summary
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Active Loans"         value={String(counts.active)}                                     icon={Banknote} />
        <StatCard label="Total Receivable"     value={formatPHP(financials.total_receivable, { compact: true })} icon={TrendingUp}    tone="info" />
        <StatCard label="Total Collected"      value={formatPHP(financials.total_collected, { compact: true })}  icon={Wallet}        tone="success" />
        <StatCard label="Outstanding"          value={formatPHP(financials.total_outstanding, { compact: true })} icon={Activity} />
        <StatCard label="Collection Efficiency" value={`${financials.collection_efficiency}%`}                   icon={Target}        tone="success" />
        <StatCard label="Overdue Accts"        value={String(counts.overdue)}                                    icon={AlertTriangle} tone="warning" />
        <StatCard label="Past Due Accts"       value={String(counts.past_due)}                                   icon={AlertOctagon}  tone="destructive" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Collector performance" subtitle="Expected vs actual today (₱)" onExport={() => downloadCsv(`collector-performance-${exportDate()}`, ["Collector", "Expected (PHP)", "Actual (PHP)", "Efficiency (%)"], stats.collector_stats.map((c) => [c.name, c.expected.toFixed(2), c.actual.toFixed(2), c.expected > 0 ? Math.round((c.actual / c.expected) * 100) : 0]))}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={collectorChartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => formatPHP(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="expected" name="Expected" fill={tokenColors.muted}    radius={[6, 6, 0, 0]} />
              <Bar dataKey="actual"   name="Actual"   fill={tokenColors.primary}  radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly collection performance" subtitle="Total collected per month" onExport={() => downloadCsv(`monthly-collections-${exportDate()}`, ["Month", "Total Collected (PHP)"], stats.monthly_collection.map((r) => [r.month, Number(r.collected)]))}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyCollection}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₱${(v / 1000000).toFixed(1)}M`} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => formatPHP(v)} />
              <Line type="monotone" dataKey="collected" stroke={tokenColors.primary} strokeWidth={2.5} dot={{ r: 3, fill: tokenColors.primary }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Loan status distribution" subtitle="Across the portfolio">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip {...tooltipStyle()} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Collector actual vs expected" subtitle="Performance ratio today">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={collectorChartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} width={90} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => formatPHP(v)} />
              <Bar dataKey="expected" name="Expected" fill={tokenColors.muted}   radius={[0, 6, 6, 0]} />
              <Bar dataKey="actual"   name="Actual"   fill={tokenColors.primary} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold">Collector performance</h3>
            <p className="text-xs text-muted-foreground">Today's expected vs collected — top performers highlighted</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => downloadCsv(`collector-performance-today-${exportDate()}`,
              ["Collector", "Area", "Assigned", "Expected (PHP)", "Actual (PHP)", "Efficiency (%)", "Missed", "Overdue", "Past Due"],
              stats.collector_stats.map((c) => {
                const r = c.expected > 0 ? Math.round((c.actual / c.expected) * 100) : 0;
                return [c.name, c.area, c.assigned, c.expected.toFixed(2), c.actual.toFixed(2), r, c.missed, c.overdue, c.past_due];
              }))}>
              <Download className="h-3.5 w-3.5" />Export
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-225">
            <TableHeader>
              <TableRow>
                <TableHead>Collector</TableHead>
                <TableHead className="text-right">Assigned</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Collection Efficiency</TableHead>
                <TableHead className="text-right">Missed</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Past Due</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.collector_stats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    No collectors found.
                  </TableCell>
                </TableRow>
              ) : stats.collector_stats.map((c) => {
                const r   = c.expected > 0 ? Math.round((c.actual / c.expected) * 100) : 0;
                const top = r >= 95;
                const low = r < 88 && c.expected > 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        {top && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">Top</span>}
                        {low && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">Low</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.area}</div>
                    </TableCell>
                    <TableCell className="text-right num">{c.assigned}</TableCell>
                    <TableCell className="text-right num">{formatPHP(c.expected)}</TableCell>
                    <TableCell className="text-right num">{formatPHP(c.actual)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`num font-semibold ${top ? "text-success" : low ? "text-warning" : ""}`}>{r}%</span>
                    </TableCell>
                    <TableCell className="text-right num">{c.missed}</TableCell>
                    <TableCell className="text-right num">{c.overdue}</TableCell>
                    <TableCell className="text-right num">{c.past_due}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/collectors/$id" params={{ id: String(c.id) }}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RiskCard title="Overdue accounts" tone="warning"
          items={stats.collector_stats.filter((c) => c.overdue > 0).map((c) => `${c.name} — ${c.overdue} overdue`)} />
        <RiskCard title="Past due accounts" tone="destructive"
          items={stats.collector_stats.filter((c) => c.past_due > 0).map((c) => `${c.name} — ${c.past_due} past due`)} />
        <RiskCard title="Low collection rate" tone="warning"
          items={stats.collector_stats.filter((c) => c.expected > 0 && (c.actual / c.expected) < 0.88).map((c) =>
            `${c.name} — ${Math.round((c.actual / c.expected) * 100)}%`
          )} />
        <RiskCard title="Top performers" tone="info"
          items={stats.collector_stats.filter((c) => c.expected > 0 && (c.actual / c.expected) >= 0.95).map((c) =>
            `${c.name} — ${Math.round((c.actual / c.expected) * 100)}%`
          )} />
      </div>
    </div>
  );
}
