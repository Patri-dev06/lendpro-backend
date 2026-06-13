import { useCallback, useEffect, useState } from "react";
import { Users, Target, Wallet, Activity, AlertTriangle, AlertOctagon, Phone, MapPin, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/finance/StatCard";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { PageHeader } from "@/components/finance/PageHeader";
import { CollectionEfficiencyBanner } from "@/components/dashboard/CollectionEfficiencyBanner";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP } from "@/lib/format";
import { ExportButtons } from "@/components/shared/ExportButtons";

interface ApiLoan {
  id: number;
  number: string;
  status: string;
  daily_payment: number;
  current_balance: number;
  client: { id: number; name: string; store_name: string; address: string; phone: string };
  collector: { id: number; name: string; area?: string };
}

interface DashboardStats {
  counts: { active: number; overdue: number; past_due: number };
  financials: { total_collected: number; collection_efficiency: number };
  collector_stats: Array<{
    id: number;
    name: string;
    area: string;
    assigned: number;
    expected: number;
    actual: number;
    missed: number;
    overdue: number;
    past_due: number;
  }>;
  loans: ApiLoan[];
}

export function CollectorDashboard() {
  const { token, user } = useRole();
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading]  = useState(true);

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

  const activeLoans = stats.loans.filter((l) => l.status !== "paid");
  const totalExpected = activeLoans.reduce((s, l) => s + l.daily_payment, 0);
  const totalCollected = stats.financials.total_collected;
  const efficiency = stats.financials.collection_efficiency;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi ${user?.name?.split(" ")[0] ?? "there"} — Today's collection plan`}
        subtitle={`${activeLoans.length} active loan${activeLoans.length !== 1 ? "s" : ""} in portfolio`}
      />

      <CollectionEfficiencyBanner
        rate={efficiency}
        collected={totalCollected}
        receivable={stats.loans.reduce((s, l) => s + l.daily_payment, 0)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Loans"    value={String(stats.counts.active)}          icon={Users} />
        <StatCard label="Expected Today"  value={formatPHP(totalExpected, { compact: true })} icon={Target}        tone="info" />
        <StatCard label="Collected"       value={formatPHP(totalCollected, { compact: true })} icon={Wallet}       tone="success" />
        <StatCard label="Shortfall"       value={formatPHP(Math.max(0, totalExpected - totalCollected), { compact: true })} icon={Activity} tone="warning" />
        <StatCard label="Overdue Accts"   value={String(stats.counts.overdue)}          icon={AlertTriangle} tone="warning" />
        <StatCard label="Past Due Accts"  value={String(stats.counts.past_due)}         icon={AlertOctagon}  tone="destructive" />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold">Active loan portfolio</h3>
            <p className="text-xs text-muted-foreground">All active clients and current balances</p>
          </div>
          <ExportButtons
            filename="active-loan-portfolio"
            title="Active loan portfolio"
            columns={[
              { header: "Client" }, { header: "Address" }, { header: "Contact" },
              { header: "Daily Due", align: "right", money: true }, { header: "Balance", align: "right", money: true },
              { header: "Status" }, { header: "Collector" },
            ]}
            rows={activeLoans.map((l) => [
              l.client.name, l.client.address, l.client.phone,
              l.daily_payment, l.current_balance, l.status, l.collector.name,
            ])}
          />
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-175">
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Daily Due</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Collector</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLoans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No active loans found.
                  </TableCell>
                </TableRow>
              ) : activeLoans.map((l) => {
                const rowTone = l.status === "past-due" ? "border-l-4 border-l-destructive"
                  : l.status === "overdue" ? "border-l-4 border-l-warning" : "";
                return (
                  <TableRow key={l.id} className={rowTone}>
                    <TableCell>
                      <div className="font-medium">{l.client.name}</div>
                      <div className="text-xs text-muted-foreground">{l.client.store_name}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {l.client.address}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <Phone className="mr-1 inline h-3 w-3" />
                      {l.client.phone}
                    </TableCell>
                    <TableCell className="text-right num">{formatPHP(l.daily_payment)}</TableCell>
                    <TableCell className="text-right num font-semibold">{formatPHP(l.current_balance)}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{l.collector.name}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
