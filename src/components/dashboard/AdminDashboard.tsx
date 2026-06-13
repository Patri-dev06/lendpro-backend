import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users, UserPlus, Repeat, AlertTriangle, AlertOctagon, CheckCircle2,
  Wallet, TrendingUp, ArrowUpRight, ArrowUp, ArrowDown, ArrowUpDown,
  Loader2, UsersRound, Gauge, RefreshCw, Trophy, Calendar, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportButtons } from "@/components/shared/ExportButtons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { StatCard } from "@/components/finance/StatCard";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { PageHeader } from "@/components/finance/PageHeader";
import { SelectTriggerSm } from "@/components/shared/SelectTriggerSm";
import { CollectionEfficiencyBanner } from "@/components/dashboard/CollectionEfficiencyBanner";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { FinStat } from "@/components/dashboard/FinStat";
import { BankBalanceCard } from "@/components/dashboard/BankBalanceCard";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP, formatDate } from "@/lib/format";
import { tokenColors, tooltipStyle } from "@/components/dashboard/dashboardConstants";

interface ApiLoan {
  id: number;
  number: string;
  status: string;
  loan_type: string;
  principal: number;
  total_receivable: number;
  daily_payment: number;
  current_balance: number;
  due_date: string;
  client: { id: number; name: string; store_name: string };
  collector: { id: number; name: string };
}

interface CollectorStat {
  id: number; name: string; code: string; area: string;
  assigned: number;
  expected_daily: number; expected_month: number;
  collected_today: number; collected_week: number;
  collected_month: number; collected_year: number;
  overdue: number; past_due: number;
}

interface MonthlyReleaseByType {
  month: string;
  new_count: string; reloan_count: string; reconstruct_count: string; total_count: string;
}

interface DashboardStats {
  counts: {
    active: number; new: number; renew: number; reconstruct: number;
    overdue: number; past_due: number; paid: number; total_clients: number;
  };
  financials: {
    total_receivable: number; total_outstanding: number;
    total_collected: number; collection_efficiency: number;
    overdue_balance: number; past_due_balance: number;
    expected_daily: number;
    collected_today: number; collected_this_week: number;
    collected_this_month: number; collected_this_year: number;
  };
  monthly_releases: Array<{ month: string; releases: string }>;
  monthly_collection: Array<{ month: string; collected: string }>;
  monthly_releases_by_type: MonthlyReleaseByType[];
  collector_stats: CollectorStat[];
  loans: ApiLoan[];
}

type EfficiencyPeriod = "daily" | "weekly" | "this_month" | "this_year";
type CollectorPeriod  = "today" | "week" | "month" | "year";

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short" });
}

function effRate(collected: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((collected / expected) * 100));
}

function collectorCollected(c: CollectorStat, p: CollectorPeriod): number {
  if (p === "today") return c.collected_today;
  if (p === "week")  return c.collected_week;
  if (p === "month") return c.collected_month;
  return c.collected_year;
}

function collectorExpected(c: CollectorStat, p: CollectorPeriod): number {
  if (p === "today") return c.expected_daily;
  if (p === "week")  return c.expected_daily * 6;
  if (p === "month") return c.expected_month;
  return c.expected_month * 12;
}

const RANK_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-600", "text-muted-foreground", "text-muted-foreground"];
const RANK_BG     = ["bg-yellow-500/10", "bg-slate-400/10", "bg-amber-600/10", "bg-muted/30", "bg-muted/30"];

export function AdminDashboard() {
  const { token } = useRole();
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [collectorFilter, setCollectorFilter] = useState("all");
  const [typeFilter, setTypeFilter]           = useState("all");
  const [effPeriod, setEffPeriod]             = useState<EfficiencyPeriod>("this_month");
  const [collectorPeriod, setCollectorPeriod] = useState<CollectorPeriod>("month");
  const [cpSort, setCpSort] = useState<"expected" | "collected" | "today" | null>(null);
  const [cpDir,  setCpDir]  = useState<"asc" | "desc">("desc");
  function toggleCpSort(col: "expected" | "collected" | "today") {
    if (cpSort === col) setCpDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setCpSort(col); setCpDir("desc"); }
  }
  const [leaderQ, setLeaderQ]                 = useState("");
  const [monSort, setMonSort]   = useState<MonSort | null>(null);
  const [monDir,  setMonDir]    = useState<"asc" | "desc">("asc");
  function toggleMonSort(col: MonSort) {
    if (monSort === col) setMonDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setMonSort(col); setMonDir("asc"); }
  }

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

  const monthlyReleases = stats.monthly_releases.map((r) => ({
    month: shortMonth(r.month), releases: Number(r.releases),
  }));
  const monthlyCollection = stats.monthly_collection.map((r) => ({
    month: shortMonth(r.month), collected: Number(r.collected),
  }));

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const thisMonthByType = stats.monthly_releases_by_type.find((r) => r.month === currentMonthStr);

  const normalActive = counts.active - counts.overdue - counts.past_due;
  const donut = [
    { name: "Active",     value: Math.max(0, normalActive), color: tokenColors.primary },
    { name: "Overdue",    value: counts.overdue,            color: tokenColors.warning },
    { name: "Past Due",   value: counts.past_due,           color: tokenColors.destructive },
    { name: "Fully Paid", value: counts.paid,               color: tokenColors.success },
  ];

  const collectors = Array.from(
    new Map(stats.loans.map((l) => [l.collector.id, l.collector])).values()
  );

  const filtered = stats.loans.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (collectorFilter !== "all" && String(l.collector.id) !== collectorFilter) return false;
    if (typeFilter !== "all" && l.loan_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${l.client.name} ${l.client.store_name}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const monFiltered = monSort
    ? [...filtered].sort((a, b) => {
        let cmp = 0;
        if (monSort === "client_name")      cmp = a.client.name.localeCompare(b.client.name);
        else if (monSort === "store_name")  cmp = a.client.store_name.localeCompare(b.client.store_name);
        else if (monSort === "due_date")    cmp = (a.due_date ?? "").localeCompare(b.due_date ?? "");
        else                               cmp = (a[monSort] as number) - (b[monSort] as number);
        return monDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  const releasesThisMonth = monthlyReleases[monthlyReleases.length - 1]?.releases ?? 0;
  const releasesThisYear  = monthlyReleases.reduce((s, m) => s + m.releases, 0);
  const ytdExpected = financials.expected_daily * 26 * 12;
  const ytdRate     = effRate(financials.collected_this_year, ytdExpected);

  const effMap: Record<EfficiencyPeriod, { collected: number; expected: number; label: string }> = {
    daily:      { collected: financials.collected_today,      expected: financials.expected_daily,           label: "Today" },
    weekly:     { collected: financials.collected_this_week,  expected: financials.expected_daily * 6,       label: "This Week" },
    this_month: { collected: financials.collected_this_month, expected: financials.expected_daily * 26,      label: "This Month" },
    this_year:  { collected: financials.collected_this_year,  expected: financials.expected_daily * 26 * 12, label: "This Year" },
  };
  const eff    = effMap[effPeriod];
  const effPct = effRate(eff.collected, eff.expected);

  const dailyRanked   = [...stats.collector_stats].sort((a, b) => b.collected_today - a.collected_today);
  const monthlyRanked = [...stats.collector_stats].sort((a, b) => b.collected_month - a.collected_month);

  const collectorPeriodLabel: Record<CollectorPeriod, string> = {
    today: "Today", week: "This Week", month: "This Month", year: "This Year",
  };

  const cpRows = cpSort
    ? [...stats.collector_stats].sort((a, b) => {
        const av = cpSort === "expected" ? collectorExpected(a, collectorPeriod)
                 : cpSort === "collected" ? collectorCollected(a, collectorPeriod)
                 : a.collected_today;
        const bv = cpSort === "expected" ? collectorExpected(b, collectorPeriod)
                 : cpSort === "collected" ? collectorCollected(b, collectorPeriod)
                 : b.collected_today;
        return cpDir === "desc" ? bv - av : av - bv;
      })
    : stats.collector_stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Daily snapshot of the loan portfolio and active client accounts."
        actions={
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary-glow">
            <Link to="/loans" search={{ clientId: undefined }}>Create new loan</Link>
          </Button>
        }
      />

      <CollectionEfficiencyBanner
        rate={financials.collection_efficiency}
        collected={financials.total_collected}
        receivable={financials.total_receivable}
      />

      {/* ── Section 1a: Portfolio counts ── */}
      <div>
        <SectionLabel>Portfolio Overview</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Clients"   value={String(counts.total_clients)} icon={UsersRound} hint="registered" />
          <StatCard label="Active Accounts" value={String(counts.active)}        icon={Users}      hint="across all collectors" />
          <StatCard label="New Loans"       value={String(counts.new)}           icon={UserPlus}   tone="info"    hint="active" />
          <StatCard label="Reloan"          value={String(counts.renew)}         icon={Repeat}     tone="purple"  hint="active" />
          <StatCard label="Reconstruct"     value={String(counts.reconstruct)}   icon={RefreshCw}  tone="warning" hint="active" />
        </div>
      </div>

      {/* ── Year-to-Date Collection Highlight ── */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 w-full bg-linear-to-r from-success via-success/60 to-primary/40" />
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1px_auto]">

            {/* Left: number + progress */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-success" />Year-to-Date Collections
              </p>
              <p className="mt-2 font-display text-5xl font-bold num text-success leading-none">
                {formatPHP(financials.collected_this_year)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Total collected from January 1 to today</p>
              <div className="mt-5 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Annual target progress</span>
                  <span className={`font-semibold num ${ytdRate >= 80 ? "text-success" : ytdRate >= 50 ? "text-warning" : "text-destructive"}`}>{ytdRate}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${ytdRate >= 80 ? "bg-success" : ytdRate >= 50 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${Math.max(ytdRate, ytdRate > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block bg-border" />

            {/* Right: mini chart + KPI pills */}
            <div className="flex flex-col gap-4 lg:w-72">
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyCollection.slice(-7)} barSize={10} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Bar dataKey="collected" radius={[4, 4, 0, 0]}
                      fill="var(--success)"
                      label={false}
                    />
                    <XAxis dataKey="month" hide />
                    <Tooltip {...tooltipStyle()} formatter={(v: number) => formatPHP(v)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/40 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground leading-tight">Expected YTD</p>
                  <p className="mt-1 text-sm font-bold num">{formatPHP(ytdExpected, { compact: true })}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground leading-tight">Collection Rate</p>
                  <p className={`mt-1 text-sm font-bold num ${ytdRate >= 80 ? "text-success" : ytdRate >= 50 ? "text-warning" : "text-destructive"}`}>{ytdRate}%</p>
                </div>
                <div className="rounded-xl bg-success/10 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground leading-tight">This Month</p>
                  <p className="mt-1 text-sm font-bold num text-success">{formatPHP(financials.collected_this_month, { compact: true })}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Section 1b: Risk & resolution — tinted cards ── */}
      <div>
        <SectionLabel>Risk &amp; Resolution</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <RiskCard label="Overdue"    value={counts.overdue}   icon={AlertTriangle} hint="needs follow-up"   variant="warning" />
          <RiskCard label="Past Due"   value={counts.past_due}  icon={AlertOctagon}  hint="critical accounts" variant="destructive" />
          <RiskCard label="Fully Paid" value={counts.paid}      icon={CheckCircle2}  hint="all time total"    variant="success" />
        </div>
      </div>

      {/* ── Section 2: Financial Summary + Overdue/Past Due Balances ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Financial Summary</p>
            <ExportButtons
              filename="financial-summary"
              title="Financial Summary"
              columns={[{ header: "Metric" }, { header: "Value", align: "right" }]}
              rows={[
                ["Total Receivable",          financials.total_receivable],
                ["Total Collected",           financials.total_collected],
                ["Total Outstanding",         financials.total_outstanding],
                ["Collection Efficiency (%)", financials.collection_efficiency],
                ["Collected Today",           financials.collected_today],
                ["Collected This Week",       financials.collected_this_week],
                ["Collected This Month",      financials.collected_this_month],
                ["Collected This Year",       financials.collected_this_year],
                ["Expected Daily",            financials.expected_daily],
                ["Overdue Balance",           financials.overdue_balance],
                ["Past Due Balance",          financials.past_due_balance],
                ["Active Loans",              counts.active],
                ["Overdue Accounts",          counts.overdue],
                ["Past Due Accounts",         counts.past_due],
                ["Paid Loans",                counts.paid],
                ["Total Clients",             counts.total_clients],
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FinStat label="Releases This Month" value={formatPHP(releasesThisMonth, { compact: true })} icon={ArrowUpRight} tone="info" />
            <FinStat label="Releases This Year"  value={formatPHP(releasesThisYear, { compact: true })}  icon={ArrowUpRight} tone="info"    sub="running total" />
            <BankBalanceCard />
            <FinStat label="Collection This Month" value={formatPHP(financials.collected_this_month, { compact: true })} icon={TrendingUp} tone="success" />
            <FinStat label="Collection Today"      value={formatPHP(financials.collected_today,      { compact: true })} icon={TrendingUp} tone="success" sub="daily collection" />
            <FinStat label="Outstanding Balance"   value={formatPHP(financials.total_outstanding,    { compact: true })} icon={Wallet}    tone="default" sub="total portfolio" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-warning/5 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-warning">Overdue Balance</p>
                <p className="mt-1 font-display text-2xl font-semibold num text-warning">
                  {formatPHP(financials.overdue_balance, { compact: true })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{counts.overdue} overdue accounts</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-destructive/5 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-destructive">Past Due Balance</p>
                <p className="mt-1 font-display text-2xl font-semibold num text-destructive">
                  {formatPHP(financials.past_due_balance, { compact: true })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{counts.past_due} past-due accounts</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertOctagon className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Efficiency + This Month's Releases by Type ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Efficiency */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />Collection Efficiency
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Actual collected vs. expected target</p>
            </div>
            <Select value={effPeriod} onValueChange={(v) => setEffPeriod(v as EfficiencyPeriod)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={effPct >= 80 ? "var(--success)" : effPct >= 50 ? "var(--warning)" : "var(--destructive)"}
                  strokeWidth="3"
                  strokeDasharray={`${effPct} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold num">{effPct}%</span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-muted-foreground w-20">Collected</span>
                <span className="font-semibold num text-success">{formatPHP(eff.collected, { compact: true })}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-muted-foreground w-20">Expected</span>
                <span className="font-semibold num">{formatPHP(eff.expected, { compact: true })}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-muted-foreground w-20">Period</span>
                <span className="font-medium">{eff.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* This Month's Releases by Type */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-4">
            <Calendar className="h-3.5 w-3.5" />This Month's Loan Releases
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "New Loan",    count: Number(thisMonthByType?.new_count ?? 0),         color: "text-info",        bg: "bg-info/10" },
              { label: "Reloan",      count: Number(thisMonthByType?.reloan_count ?? 0),       color: "text-purple-500",  bg: "bg-purple-500/10" },
              { label: "Reconstruct", count: Number(thisMonthByType?.reconstruct_count ?? 0),  color: "text-warning",     bg: "bg-warning/10" },
              { label: "Total",       count: Number(thisMonthByType?.total_count ?? 0),        color: "text-primary",     bg: "bg-primary/10" },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-4 ${item.bg}`}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`mt-1 font-display text-3xl font-bold num ${item.color}`}>{item.count}</p>
                <p className="text-xs text-muted-foreground">loans released</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 4: Charts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Loan account status" subtitle="Distribution across portfolio">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
                {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip {...tooltipStyle()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
            {donut.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="ml-auto font-medium num">{d.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Monthly loan releases" subtitle="Total disbursed per month" exportConfig={{
          filename: "monthly-releases",
          columns: [{ header: "Month" }, { header: "Total Released", align: "right", money: true }],
          rows: stats.monthly_releases.map((r) => [r.month, Number(r.releases)]),
        }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyReleases}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => formatPHP(v)} />
              <Bar dataKey="releases" fill={tokenColors.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly collections" subtitle="Total collected per month" exportConfig={{
          filename: "monthly-collections",
          columns: [{ header: "Month" }, { header: "Total Collected", align: "right", money: true }],
          rows: stats.monthly_collection.map((r) => [r.month, Number(r.collected)]),
        }}>

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyCollection}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => formatPHP(v)} />
              <Line type="monotone" dataKey="collected" stroke={tokenColors.success} strokeWidth={2.5} dot={{ r: 3, fill: tokenColors.success }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Section 5: Collector Performance ── */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold">Collector Performance</h3>
            <p className="text-xs text-muted-foreground">Collection targets vs. actuals — {collectorPeriodLabel[collectorPeriod]}</p>
          </div>
          <div className="flex items-center gap-2">
          <ExportButtons
            filename={`collector-performance-${collectorPeriod}`}
            title="Collector Performance"
            subtitle={collectorPeriodLabel[collectorPeriod]}
            columns={[
              { header: "Collector" }, { header: "Area" }, { header: "Clients", align: "right" },
              { header: "Expected", align: "right", money: true }, { header: "Collected", align: "right", money: true },
              { header: "Today", align: "right", money: true }, { header: "This Month", align: "right", money: true },
              { header: "This Year", align: "right", money: true }, { header: "Rate (%)", align: "right" },
              { header: "Overdue", align: "right" }, { header: "Past Due", align: "right" },
            ]}
            rows={cpRows.map((c) => {
              const collected = collectorCollected(c, collectorPeriod);
              const expected  = collectorExpected(c, collectorPeriod);
              return [c.name, c.area, c.assigned, expected, collected,
                c.collected_today, c.collected_month, c.collected_year,
                `${effRate(collected, expected)}%`, c.overdue, c.past_due];
            })}
          />
          <Select value={collectorPeriod} onValueChange={(v) => setCollectorPeriod(v as CollectorPeriod)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>Collector</TableHead>
                <TableHead>Area</TableHead>
                <TableHead className="text-center">Clients</TableHead>
                <CpSortHead col="expected"  label="Expected"  sort={cpSort} dir={cpDir} onSort={toggleCpSort} />
                <CpSortHead col="collected" label="Collected" sort={cpSort} dir={cpDir} onSort={toggleCpSort} />
                <CpSortHead col="today"     label="Today"     sort={cpSort} dir={cpDir} onSort={toggleCpSort} />
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">This Year</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="text-center">Overdue</TableHead>
                <TableHead className="text-center">Past Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cpRows.map((c) => {
                const collected = collectorCollected(c, collectorPeriod);
                const expected  = collectorExpected(c, collectorPeriod);
                const rate      = effRate(collected, expected);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.area}</TableCell>
                    <TableCell className="text-center num">{c.assigned}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{formatPHP(expected, { compact: true })}</TableCell>
                    <TableCell className="text-right num font-semibold text-success">{formatPHP(collected, { compact: true })}</TableCell>
                    <TableCell className="text-right num text-xs">{formatPHP(c.collected_today, { compact: true })}</TableCell>
                    <TableCell className="text-right num text-xs">{formatPHP(c.collected_month, { compact: true })}</TableCell>
                    <TableCell className="text-right num text-xs">{formatPHP(c.collected_year, { compact: true })}</TableCell>
                    <TableCell className="min-w-32">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${rate >= 80 ? "bg-success" : rate >= 50 ? "bg-warning" : "bg-destructive"}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium num w-9 text-right">{rate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {c.overdue > 0 ? <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">{c.overdue}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.past_due > 0 ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{c.past_due}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {stats.collector_stats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">No collectors found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Section 6: Leaderboard ── */}
      <div className="rounded-2xl border bg-card shadow-sm">
        {/* Leaderboard header + search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <h3 className="font-display text-base font-semibold">Collection Leaderboard</h3>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-52 pl-8 text-sm"
              placeholder="Find collector…"
              value={leaderQ}
              onChange={(e) => setLeaderQ(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
          {/* Daily */}
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
            <LeaderList
              ranked={dailyRanked}
              query={leaderQ}
              getValue={(c) => c.collected_today}
              getExpected={(c) => c.expected_daily}
              emptyMsg="No data yet today."
            />
          </div>

          {/* Monthly */}
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Month</p>
            <LeaderList
              ranked={monthlyRanked}
              query={leaderQ}
              getValue={(c) => c.collected_month}
              getExpected={(c) => c.expected_month}
              emptyMsg="No data yet this month."
            />
          </div>
        </div>
      </div>

      {/* ── Section 7: Collector Performance Summary ── */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold">Collector Performance Summary</h3>
            <p className="text-xs text-muted-foreground">Clients, collectible, collected, and efficiency per collector</p>
          </div>
          <ExportButtons
            filename="collector-summary"
            title="Collector Performance Summary"
            columns={[
              { header: "Collector" }, { header: "Clients", align: "right" },
              { header: "Daily Collectible", align: "right", money: true }, { header: "Daily Collected", align: "right", money: true }, { header: "Daily Eff%", align: "right" },
              { header: "Weekly Collectible", align: "right", money: true }, { header: "Weekly Collected", align: "right", money: true }, { header: "Weekly Eff%", align: "right" },
              { header: "Monthly Collectible", align: "right", money: true }, { header: "Monthly Collected", align: "right", money: true }, { header: "Monthly Eff%", align: "right" },
            ]}
            rows={stats.collector_stats.map((c) => [
              c.name, c.assigned,
              c.expected_daily, c.collected_today, `${effRate(c.collected_today, c.expected_daily)}%`,
              c.expected_daily * 6, c.collected_week, `${effRate(c.collected_week, c.expected_daily * 6)}%`,
              c.expected_month, c.collected_month, `${effRate(c.collected_month, c.expected_month)}%`,
            ])}
          />
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-225">
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead rowSpan={2} className="align-middle">Collector</TableHead>
                <TableHead rowSpan={2} className="align-middle text-right">Clients</TableHead>
                <TableHead colSpan={3} className="text-center border-l text-info">Daily</TableHead>
                <TableHead colSpan={3} className="text-center border-l text-purple-500">Weekly</TableHead>
                <TableHead colSpan={3} className="text-center border-l text-success">Monthly</TableHead>
              </TableRow>
              <TableRow className="text-xs">
                <TableHead className="border-l text-right text-muted-foreground">Collectible</TableHead>
                <TableHead className="text-right text-muted-foreground">Collected</TableHead>
                <TableHead className="text-right text-muted-foreground">Eff %</TableHead>
                <TableHead className="border-l text-right text-muted-foreground">Collectible</TableHead>
                <TableHead className="text-right text-muted-foreground">Collected</TableHead>
                <TableHead className="text-right text-muted-foreground">Eff %</TableHead>
                <TableHead className="border-l text-right text-muted-foreground">Collectible</TableHead>
                <TableHead className="text-right text-muted-foreground">Collected</TableHead>
                <TableHead className="text-right text-muted-foreground">Eff %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.collector_stats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                    No collector data available.
                  </TableCell>
                </TableRow>
              ) : stats.collector_stats.map((c) => {
                const dailyEff   = effRate(c.collected_today, c.expected_daily);
                const weeklyEff  = effRate(c.collected_week,  c.expected_daily * 6);
                const monthlyEff = effRate(c.collected_month, c.expected_month);
                function effColor(r: number) {
                  return r >= 80 ? "text-success" : r >= 50 ? "text-warning" : "text-destructive";
                }
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.area}</p>
                    </TableCell>
                    <TableCell className="text-right num">{c.assigned}</TableCell>
                    {/* Daily */}
                    <TableCell className="border-l text-right num text-sm">{formatPHP(c.expected_daily,       { compact: true })}</TableCell>
                    <TableCell className="text-right num text-sm">{formatPHP(c.collected_today,              { compact: true })}</TableCell>
                    <TableCell className={`text-right num font-semibold ${effColor(dailyEff)}`}>{dailyEff}%</TableCell>
                    {/* Weekly */}
                    <TableCell className="border-l text-right num text-sm">{formatPHP(c.expected_daily * 6,  { compact: true })}</TableCell>
                    <TableCell className="text-right num text-sm">{formatPHP(c.collected_week,               { compact: true })}</TableCell>
                    <TableCell className={`text-right num font-semibold ${effColor(weeklyEff)}`}>{weeklyEff}%</TableCell>
                    {/* Monthly */}
                    <TableCell className="border-l text-right num text-sm">{formatPHP(c.expected_month,      { compact: true })}</TableCell>
                    <TableCell className="text-right num text-sm">{formatPHP(c.collected_month,              { compact: true })}</TableCell>
                    <TableCell className={`text-right num font-semibold ${effColor(monthlyEff)}`}>{monthlyEff}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Section 8: Client Monitoring ── */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold">Client monitoring</h3>
            <p className="text-xs text-muted-foreground">All active client accounts and loan health</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons
              filename="client-monitoring"
              title="Client monitoring"
              columns={[
                { header: "Client" }, { header: "Store" }, { header: "Loan #" }, { header: "Type" },
                { header: "Principal", align: "right", money: true }, { header: "Net", align: "right", money: true },
                { header: "Daily", align: "right", money: true }, { header: "Balance", align: "right", money: true },
                { header: "Due Date" }, { header: "Status" },
              ]}
              rows={monFiltered.map((l) => [l.client.name, l.client.store_name, l.number, l.loan_type,
                l.principal, l.total_receivable, l.daily_payment, l.current_balance, l.due_date ? formatDate(l.due_date) : "", l.status])}
            />
            <Input placeholder="Search client…" className="h-9 w-48" value={search} onChange={(e) => setSearch(e.target.value)} />
            <SelectTriggerSm value={statusFilter} onChange={setStatusFilter} placeholder="Status" options={[
              { v: "all", l: "All status" }, { v: "new", l: "New" }, { v: "renew", l: "Renew" },
              { v: "overdue", l: "Overdue" }, { v: "past-due", l: "Past Due" }, { v: "paid", l: "Fully Paid" },
            ]} />
            <SelectTriggerSm value={collectorFilter} onChange={setCollectorFilter} placeholder="Collector" options={[
              { v: "all", l: "All collectors" }, ...collectors.map((c) => ({ v: String(c.id), l: c.name })),
            ]} />
            <SelectTriggerSm value={typeFilter} onChange={setTypeFilter} placeholder="Loan type" options={[
              { v: "all", l: "All types" }, { v: "new-loan", l: "New Loan" },
              { v: "reloan", l: "Reloan" }, { v: "reconstruct", l: "Reconstruct" },
            ]} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-250">
            <TableHeader>
              <TableRow className="text-xs">
                <DashSortHead col="client_name"      label="Client"      sort={monSort} dir={monDir} onSort={toggleMonSort} />
                <DashSortHead col="store_name"       label="Store"       sort={monSort} dir={monDir} onSort={toggleMonSort} />
                <DashSortHead col="principal"        label="Principal"   sort={monSort} dir={monDir} onSort={toggleMonSort} align="right" />
                <DashSortHead col="total_receivable" label="Receivable"  sort={monSort} dir={monDir} onSort={toggleMonSort} align="right" />
                <DashSortHead col="daily_payment"    label="Daily"       sort={monSort} dir={monDir} onSort={toggleMonSort} align="right" />
                <DashSortHead col="current_balance"  label="Balance"     sort={monSort} dir={monDir} onSort={toggleMonSort} align="right" />
                <DashSortHead col="due_date"         label="Due Date"    sort={monSort} dir={monDir} onSort={toggleMonSort} />
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Collector</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monFiltered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.client.store_name}</TableCell>
                  <TableCell className="text-right num">{formatPHP(l.principal)}</TableCell>
                  <TableCell className="text-right num">{formatPHP(l.total_receivable)}</TableCell>
                  <TableCell className="text-right num">{formatPHP(l.daily_payment)}</TableCell>
                  <TableCell className="text-right num font-semibold">{formatPHP(l.current_balance)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.due_date ? formatDate(l.due_date) : "—"}</TableCell>
                  <TableCell><StatusBadge status={l.loan_type} /></TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{l.collector.name}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    No accounts match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/* ── Local helpers ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

type RiskVariant = "orange" | "warning" | "destructive" | "success";

const riskStyles: Record<RiskVariant, { border: string; bg: string; icon: string; label: string }> = {
  orange:      { border: "border-orange-200 dark:border-orange-900/40",    bg: "bg-orange-50/70 dark:bg-orange-950/20",   icon: "bg-orange-100 text-orange-500 dark:bg-orange-900/40 dark:text-orange-400", label: "text-orange-600 dark:text-orange-400" },
  warning:     { border: "border-warning/35",     bg: "bg-warning/5",      icon: "bg-warning/15 text-warning",            label: "text-warning" },
  destructive: { border: "border-destructive/30", bg: "bg-destructive/5",  icon: "bg-destructive/10 text-destructive",    label: "text-destructive" },
  success:     { border: "border-success/30",     bg: "bg-success/5",      icon: "bg-success/10 text-success",            label: "text-success" },
};

function rankStyle(rank: number): { color: string; bg: string } {
  if (rank === 1) return { color: "text-yellow-500", bg: "bg-yellow-500/10" };
  if (rank === 2) return { color: "text-slate-400",  bg: "bg-slate-400/10" };
  if (rank === 3) return { color: "text-amber-600",  bg: "bg-amber-600/10" };
  return { color: "text-muted-foreground", bg: "bg-muted/30" };
}

function LeaderList({
  ranked, query, getValue, getExpected, emptyMsg,
}: {
  ranked: CollectorStat[];
  query: string;
  getValue: (c: CollectorStat) => number;
  getExpected: (c: CollectorStat) => number;
  emptyMsg: string;
}) {
  const q = query.trim().toLowerCase();

  const rows: { collector: CollectorStat; rank: number; highlight: boolean }[] = q
    ? ranked
        .map((c, i) => ({ collector: c, rank: i + 1, highlight: c.name.toLowerCase().includes(q) }))
        .filter((r) => r.highlight)
    : ranked.slice(0, 5).map((c, i) => ({ collector: c, rank: i + 1, highlight: false }));

  if (ranked.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">{emptyMsg}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No collector matches "{query}".</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map(({ collector: c, rank, highlight }) => {
        const { color, bg } = rankStyle(rank);
        return (
          <div
            key={c.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${highlight ? "ring-2 ring-primary/40 " + bg : bg}`}
          >
            <span className={`w-6 shrink-0 text-center text-sm font-bold ${color}`}>#{rank}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.area}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold num text-success">{formatPHP(getValue(c), { compact: true })}</p>
              <p className="text-xs text-muted-foreground">of {formatPHP(getExpected(c), { compact: true })}</p>
            </div>
          </div>
        );
      })}
      {!q && ranked.length > 5 && (
        <p className="text-center text-xs text-muted-foreground pt-1">
          +{ranked.length - 5} more — search by name to find their position
        </p>
      )}
    </div>
  );
}

function CpSortHead({ col, label, sort, dir, onSort }: {
  col: "expected" | "collected" | "today";
  label: string;
  sort: "expected" | "collected" | "today" | null;
  dir: "asc" | "desc";
  onSort: (col: "expected" | "collected" | "today") => void;
}) {
  const active = sort === col;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className="text-right">
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors hover:text-foreground ${active ? "text-foreground font-semibold" : "text-muted-foreground font-normal"}`}
      >
        {label}<Icon className="h-3 w-3 shrink-0" />
      </button>
    </TableHead>
  );
}

type MonSort = "client_name" | "store_name" | "principal" | "total_receivable" | "daily_payment" | "current_balance" | "due_date";

function DashSortHead({
  col, label, sort, dir, onSort, align = "left",
}: {
  col: MonSort;
  label: string;
  sort: MonSort | null;
  dir: "asc" | "desc";
  onSort: (col: MonSort) => void;
  align?: "left" | "right";
}) {
  const active = sort === col;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors hover:text-foreground ${active ? "text-foreground font-semibold" : "text-muted-foreground font-normal"}`}
      >
        {label}
        <Icon className="h-3 w-3 shrink-0" />
      </button>
    </TableHead>
  );
}

function RiskCard({ label, value, icon: Icon, hint, variant }: {
  label: string; value: number; icon: React.ElementType;
  hint: string; variant: RiskVariant;
}) {
  const s = riskStyles[variant];
  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-5 shadow-sm transition hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className={`text-xs font-medium uppercase tracking-wide ${s.label}`}>{label}</p>
          <p className="font-display text-2xl font-semibold tracking-tight num">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
