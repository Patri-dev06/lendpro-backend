import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Paginator } from "@/components/shared/Paginator";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { PermissionGuard } from "@/components/shared/AccessRestricted";
import { toast } from "sonner";

const PAGE_SIZE = 25;

interface AuditLog {
  id: number;
  action: string;
  record: string | null;
  description: string | null;
  ip_address: string | null;
  performed_at: string;
  user: { id: number; name: string; email: string; role: string } | null;
}

/* Actions we want to offer as filter choices */
const ACTION_OPTIONS = [
  "LOGIN", "LOGOUT", "REGISTER",
  "CREATE_CLIENT", "UPDATE_CLIENT", "DELETE_CLIENT",
  "CREATE_LOAN",   "UPDATE_LOAN",   "DELETE_LOAN",
  "CREATE_PAYMENT","UPDATE_PAYMENT","DELETE_PAYMENT",
  "CREATE_USER",   "UPDATE_USER",   "DELETE_USER",
  "CREATE_COLLECTOR","UPDATE_COLLECTOR","DELETE_COLLECTOR",
  "REGENERATE_SCHEDULE",
];

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

/* Colour the action badge */
function actionBadgeClass(action: string) {
  if (action.startsWith("DELETE"))  return "bg-destructive/10 text-destructive border-destructive/20";
  if (action.startsWith("CREATE") || action === "REGISTER") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (action.startsWith("UPDATE") || action.startsWith("REGENERATE")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (action === "LOGIN")  return "bg-primary/10 text-primary border-primary/20";
  if (action === "LOGOUT") return "bg-muted text-muted-foreground border-border";
  return "bg-secondary text-secondary-foreground border-border";
}

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [{ title: "Audit Logs — BuenaMano" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { token } = useRole();
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  /* Filters */
  const [q, setQ]             = useState("");
  const [action, setAction]   = useState("all");
  const [date, setDate]       = useState("");
  const [page, setPage]       = useState(1);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (action !== "all") params.set("action", action);
      const path = `reports/audit-logs${params.toString() ? `?${params}` : ""}`;
      const data = await apiRequest<AuditLog[]>("GET", path, { token });
      setLogs(data);
    } catch {
      toast.error("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [token, action]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  /* Client-side text + date filter */
  const filtered = useMemo(() => {
    const search = q.toLowerCase();
    return logs.filter((l) => {
      const matchDate = !date || l.performed_at.startsWith(date);
      const matchText = !search ||
        l.user?.name.toLowerCase().includes(search) ||
        l.action.toLowerCase().includes(search) ||
        (l.record ?? "").toLowerCase().includes(search) ||
        (l.description ?? "").toLowerCase().includes(search);
      return matchDate && matchText;
    });
  }, [logs, q, date]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  /* Reset to page 1 when filters change */
  useEffect(() => { setPage(1); }, [q, date, action]);

  return (
    <PermissionGuard permission="audit:read">
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        subtitle="Trace every meaningful change made inside the system."
        actions={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-48 pl-8 text-sm"
              placeholder="Search user, record…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Input
            type="date"
            className="h-9 w-44 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-52 text-sm"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(q || date || action !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 text-xs"
              onClick={() => { setQ(""); setDate(""); setAction("all"); }}>
              Clear filters
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {loading ? "Loading…" : `${filtered.length} of ${logs.length} entries`}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Loading audit logs…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  {logs.length === 0 ? "No audit log entries yet." : "No entries match your filters."}
                </td></tr>
              ) : paged.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTs(l.performed_at)}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {l.user?.name ?? <span className="italic text-muted-foreground">system</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">
                    {l.user?.role?.replace(/_/g, " ") ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${actionBadgeClass(l.action)}`}>
                      {l.action}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {l.record ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <span className="line-clamp-2">{l.description ?? "—"}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {l.ip_address ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Paginator page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>
    </div>
    </PermissionGuard>
  );
}
