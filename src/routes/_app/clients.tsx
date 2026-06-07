import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Eye, Mail, MailCheck, Loader2, FileText, Pencil, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { PH_PROVINCES, PH_CITIES } from "@/lib/ph-locations";
import { getBarangays } from "@/lib/ph-barangays";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/shared/AccessRestricted";

/* ---------- Types ---------- */
interface Collector { id: number; name: string; code: string; area: string; }
interface Client {
  id: number; number: string; name: string;
  first_name: string | null; middle_name: string | null; last_name: string | null;
  store_name: string;
  address: string; phone: string; email: string | null;
  type: string; status: string; approval_status: string;
  has_outstanding_loan: boolean;
  collector_id: number;
  latitude: number | null; longitude: number | null;
  created_at: string;
  collector?: Collector;
}

/* ---------- Email templates ---------- */
const EMAIL_TEMPLATES = {
  reminder: {
    label: "Payment Reminder",
    subject: () => "Payment Reminder — BuenaMano",
    body: (name: string) =>
      `Dear ${name},\n\nThis is a friendly reminder that your loan account with BuenaMano has an outstanding balance.\n\nYour daily payment is due today. Please coordinate with your assigned collector.\n\nThank you for your continued trust in BuenaMano.\n\nBuenaMano Loan & Collection`,
  },
  statement: {
    label: "Loan Statement",
    subject: () => "Your Loan Statement — BuenaMano",
    body: (name: string) =>
      `Dear ${name},\n\nPlease find below a summary of your current loan account with BuenaMano.\n\nFor a detailed breakdown, please coordinate with our office or your assigned collector.\n\nBuenaMano Loan & Collection`,
  },
  overdue: {
    label: "Overdue Notice",
    subject: () => "Important: Overdue Account Notice — BuenaMano",
    body: (name: string) =>
      `Dear ${name},\n\nOur records show that your loan account is currently overdue.\n\nWe urge you to settle your outstanding balance at your earliest convenience to avoid additional charges.\n\nPlease contact your assigned collector or our office immediately.\n\nBuenaMano Loan & Collection`,
  },
  custom: { label: "Custom Message", subject: () => "", body: () => "" },
};

/* ---------- Route ---------- */
export const Route = createFileRoute("/_app/clients")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({ meta: [{ title: "Clients — BuenaMano" }] }),
  component: ClientsPage,
});

/* ---------- Page ---------- */
function ClientsPage() {
  const { token, role } = useRole();
  const navigate = useNavigate();
  const { q: initialQ } = Route.useSearch();
  const [clients, setClients] = useState<Client[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(initialQ);
  const [approvingId, setApprovingId]   = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Client | null>(null);
  const [rejecting, setRejecting]       = useState(false);

  // Sync local search state when the URL search param changes (e.g. from TopBar)
  useEffect(() => { setQ(initialQ); }, [initialQ]);
  const [type, setType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [collectorFilter, setCollectorFilter] = useState("all");
  const [sortCol, setSortCol] = useState<"number" | "name" | "store_name" | "created_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [emailClient, setEmailClient] = useState<Client | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return; // auth not ready yet — wait for token to be set
    try {
      const [cls, cols] = await Promise.all([
        apiRequest<Client[]>("GET", "clients", { token }),
        apiRequest<Collector[]>("GET", "collectors", { token }),
      ]);
      setClients(cls);
      setCollectors(cols);
    } catch {
      toast.error("Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleApprove(client: Client) {
    setApprovingId(client.id);
    try {
      await apiRequest("POST", `clients/${client.id}/approve`, { token: token ?? undefined });
      toast.success(`${client.name} approved.`);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve client.");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget || !token) return;
    setRejecting(true);
    try {
      await apiRequest("POST", `clients/${rejectTarget.id}/reject`, { token });
      toast.success(`${rejectTarget.name} rejected and removed.`);
      setRejectTarget(null);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject client.");
    } finally {
      setRejecting(false);
    }
  }

  const pendingCount = clients.filter((c) => c.approval_status === "pending_approval").length;

  const filtered = clients.filter((c) =>
    (type === "all" || c.type === type) &&
    (statusFilter === "all" || c.status === statusFilter) &&
    (collectorFilter === "all" || String(c.collector_id) === collectorFilter) &&
    (`${c.name} ${c.store_name} ${c.number}`.toLowerCase().includes(q.toLowerCase()))
  );

  function toggleSort(col: ClientSortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }
  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = sortCol === "store_name" ? a.store_name : a[sortCol as keyof Client] as string;
        const bv = sortCol === "store_name" ? b.store_name : b[sortCol as keyof Client] as string;
        const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: sortCol === "number" });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  const emailCount = clients.filter((c) => c.email).length;

  return (
    <PermissionGuard permission="clients:read">
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Manage client profiles, contact details, and collector assignments."
        actions={
          <div className="flex items-center gap-2">
            {emailCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-3 py-1 text-xs font-medium text-info">
                <MailCheck className="h-3.5 w-3.5" />{emailCount} with email
              </span>
            )}
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary-glow"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />Add new client
            </Button>
          </div>
        }
      />

      {/* Pending approval banner — admin only */}
      {role === "admin" && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-medium text-amber-800 dark:text-amber-300">
            {pendingCount} client{pendingCount > 1 ? "s" : ""} pending approval
          </span>
          <span className="text-amber-600 dark:text-amber-500 text-xs">
            Review and approve or reject duplicate registrations below.
          </span>
        </div>
      )}

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <div className="relative flex-1 min-w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, store, or client number…" className="h-9 pl-8" />
          </div>
          <div className="w-38">
            <SearchableCombobox
              options={[
                { value: "all", label: "All types" },
                { value: "new", label: "New Loan" },
                { value: "renew", label: "Reloan" },
              ]}
              value={type}
              onChange={(v) => setType(v || "all")}
              placeholder="Type…"
            />
          </div>
          <div className="w-38">
            <SearchableCombobox
              options={[
                { value: "all", label: "All statuses" },
                { value: "new", label: "New" },
                { value: "renew", label: "Renew" },
                { value: "overdue", label: "Overdue" },
                { value: "past-due", label: "Past Due" },
                { value: "paid", label: "Paid" },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || "all")}
              placeholder="Status…"
            />
          </div>
          <div className="w-48">
            <SearchableCombobox
              options={[
                { value: "all", label: "All collectors" },
                ...collectors.map((c) => ({ value: String(c.id), label: c.name, sub: c.area })),
              ]}
              value={collectorFilter}
              onChange={(v) => setCollectorFilter(v || "all")}
              placeholder="Collector…"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading clients…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {q || type !== "all" ? "No clients match your search." : "No clients yet. Add your first client."}
            </div>
          ) : (
            <Table className="min-w-225">
              <TableHeader>
                <TableRow className="text-xs">
                  <ClientSortHead col="number"     label="Client #"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                  <ClientSortHead col="name"        label="Name"        sort={sortCol} dir={sortDir} onSort={toggleSort} />
                  <TableHead>Address</TableHead>
                  <ClientSortHead col="store_name" label="Store"       sort={sortCol} dir={sortDir} onSort={toggleSort} />
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Collector</TableHead>
                  <TableHead>Status</TableHead>
                  <ClientSortHead col="created_at" label="Date Joined" sort={sortCol} dir={sortDir} onSort={toggleSort} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.email && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />{c.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-45 truncate">{c.address}</TableCell>
                    <TableCell>{c.store_name}</TableCell>
                    <TableCell className="text-xs">{c.phone}</TableCell>
                    <TableCell><StatusBadge status={c.type} /></TableCell>
                    <TableCell className="text-muted-foreground">{c.collector?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={c.status} />
                        {c.approval_status === "pending_approval" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            <AlertTriangle className="h-2.5 w-2.5" />Pending Approval
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {role === "admin" && c.approval_status === "pending_approval" && (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(c)}
                              disabled={approvingId === c.id}
                            >
                              {approvingId === c.id
                                ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                              Approve
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectTarget(c)}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                            </Button>
                          </>
                        )}
                        {c.email && (
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-info hover:text-info"
                            onClick={() => setEmailClient(c)}>
                            <Mail className="mr-1 h-3.5 w-3.5" />Email
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setEditClient(c)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />Edit
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/clients/$clientId" params={{ clientId: String(c.id) }}>
                            <Eye className="mr-1 h-3.5 w-3.5" />View
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add client dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <AddClientDialog
          collectors={collectors}
          token={token ?? undefined}
          onSaved={() => { setAddOpen(false); fetchData(); }}
          onSavedAndCreateLoan={(clientId) => {
            setAddOpen(false);
            fetchData();
            navigate({ to: "/loans", search: { clientId } });
          }}
          onCancel={() => setAddOpen(false)}
        />
      </Dialog>

      {/* Edit client dialog */}
      {editClient && (
        <Dialog open onOpenChange={(open) => { if (!open) setEditClient(null); }}>
          <EditClientDialog
            client={editClient}
            collectors={collectors}
            token={token ?? undefined}
            onSaved={() => { setEditClient(null); fetchData(); }}
            onCancel={() => setEditClient(null)}
          />
        </Dialog>
      )}

      {/* Email dialog */}
      {emailClient && (
        <EmailDialog client={emailClient} onClose={() => setEmailClient(null)} />
      )}

      {/* Reject confirmation dialog */}
      {rejectTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Duplicate Client</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <p>Permanently remove this client registration? This cannot be undone.</p>
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{rejectTarget.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store</span>
                  <span className="font-medium">{rejectTarget.store_name}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>Go Back</Button>
              <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
                {rejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reject & Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </PermissionGuard>
  );
}

/* ---------- Add Client Dialog ---------- */
interface AddClientDialogProps {
  collectors: Collector[];
  token?: string;
  onSaved: () => void;
  onSavedAndCreateLoan: (clientId: number) => void;
  onCancel: () => void;
}

function AddClientDialog({ collectors, token, onSaved, onSavedAndCreateLoan, onCancel }: AddClientDialogProps) {
  const [firstName, setFirstName]   = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName]     = useState("");
  const [phone, setPhone]           = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail]         = useState("");
  const [province, setProvince]       = useState("");
  const [city, setCity]               = useState("");
  const [barangay, setBarangay]       = useState("");
  const [street, setStreet]           = useState("");
  const [type, setType]           = useState("new");
  const [collectorId, setCollectorId] = useState(collectors[0]?.id?.toString() ?? "");
  const [latitude, setLatitude]   = useState("");
  const [longitude, setLongitude] = useState("");
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName   = "First name is required.";
    if (!lastName.trim())  e.lastName    = "Last name / Surname is required.";
    if (!phone.trim())                          e.phone = "Cellphone number is required.";
    else if (phone.replace(/\D/g, "").length !== 10) e.phone = "Enter 10 digits after +63 (e.g. 917 000 0000).";
    if (!storeName.trim()) e.storeName   = "Store name is required.";
    if (!province)         e.province    = "Province is required.";
    if (!city)             e.city        = "City / Municipality is required.";
    if (!barangay.trim())  e.barangay    = "Barangay is required.";
    if (!street.trim())    e.street      = "Street is required.";
    if (!collectorId)      e.collectorId = "Please assign a collector.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                           e.email       = "Invalid email address.";
    if (latitude && (isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90))
                           e.latitude    = "Must be between -90 and 90.";
    if (longitude && (isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180))
                           e.longitude   = "Must be between -180 and 180.";
    return e;
  }

  async function submit(goToLoan: boolean) {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    const fullAddress = [street.trim(), barangay.trim(), city, province]
      .filter(Boolean)
      .join(", ");

    const localPhone = "0" + phone.replace(/\D/g, "");

    setLoading(true);
    try {
      const newClient = await apiRequest<Client>("POST", "clients", {
        token,
        body: {
          first_name:   firstName.trim(),
          middle_name:  middleName.trim() || null,
          last_name:    lastName.trim(),
          phone:        localPhone,
          store_name:   storeName.trim(),
          email:        email.trim() || null,
          address:      fullAddress,
          type,
          collector_id: Number(collectorId),
          latitude:     latitude ? Number(latitude) : null,
          longitude:    longitude ? Number(longitude) : null,
        },
      });
      if (newClient.approval_status === "pending_approval") {
        toast.warning("Client saved — pending approval", {
          description: "A duplicate name or store was detected. An Administrator must approve this client before they can be assigned a loan.",
        });
      } else {
        toast.success("Client saved!", { description: `${newClient.name} has been added successfully.` });
      }
      if (goToLoan) {
        onSavedAndCreateLoan(newClient.id);
      } else {
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save client.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Add new client</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <Field label="First name" error={errors.firstName}>
          <Input value={firstName} onChange={(e) => { setFirstName(e.target.value.toUpperCase()); setErrors((p) => ({ ...p, firstName: "" })); }}
            placeholder="JUAN" disabled={loading} className={errors.firstName ? "border-destructive uppercase" : "uppercase"} />
        </Field>

        <Field label="Last name / Surname" error={errors.lastName}>
          <Input value={lastName} onChange={(e) => { setLastName(e.target.value.toUpperCase()); setErrors((p) => ({ ...p, lastName: "" })); }}
            placeholder="DELA CRUZ" disabled={loading} className={errors.lastName ? "border-destructive uppercase" : "uppercase"} />
        </Field>

        <Field label="Middle name (optional)" full>
          <Input value={middleName} onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
            placeholder="SANTOS" disabled={loading} className="uppercase" />
        </Field>

        <Field label="Cellphone number" error={errors.phone}>
          <div className={`flex h-9 w-full overflow-hidden rounded-md border bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${errors.phone ? "border-destructive" : "border-input"}`}>
            <span className="flex items-center border-r bg-muted px-3 text-muted-foreground select-none">+63</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, "")); setErrors((p) => ({ ...p, phone: "" })); }}
              placeholder="917 000 0000"
              disabled={loading}
              className="flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </Field>

        <Field label="Store / Business name" error={errors.storeName}>
          <Input value={storeName} onChange={(e) => { setStoreName(e.target.value.toUpperCase()); setErrors((p) => ({ ...p, storeName: "" })); }}
            placeholder="JUAN SARI-SARI STORE" disabled={loading} className={errors.storeName ? "border-destructive uppercase" : "uppercase"} />
        </Field>

        <Field label="Email address (optional)" error={errors.email}>
          <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
            placeholder="client@email.com" disabled={loading} className={errors.email ? "border-destructive" : ""} />
        </Field>

        <Field label="Province" error={errors.province}>
          <SearchableCombobox
            options={PH_PROVINCES.map((p) => ({ value: p, label: p }))}
            value={province}
            onChange={(v) => { setProvince(v); setCity(""); setBarangay(""); setErrors((p) => ({ ...p, province: "" })); }}
            placeholder="Search province…"
            error={!!errors.province}
            disabled={loading}
          />
        </Field>

        <Field label="City / Municipality" error={errors.city}>
          <SearchableCombobox
            options={(PH_CITIES[province] ?? []).map((c) => ({ value: c, label: c }))}
            value={city}
            onChange={(v) => { setCity(v); setBarangay(""); setErrors((p) => ({ ...p, city: "" })); }}
            placeholder={province ? "Search city…" : "Select province first"}
            error={!!errors.city}
            disabled={loading || !province}
          />
        </Field>

        <Field label="Barangay" full error={errors.barangay}>
          {getBarangays(province, city).length > 0 ? (
            <SearchableCombobox
              options={getBarangays(province, city).map((b) => ({ value: b, label: b }))}
              value={barangay}
              onChange={(v) => { setBarangay(v); setErrors((p) => ({ ...p, barangay: "" })); }}
              placeholder={city ? "Search barangay…" : "Select city first"}
              error={!!errors.barangay}
              disabled={loading || !city}
            />
          ) : (
            <Input
              value={barangay}
              onChange={(e) => { setBarangay(e.target.value); setErrors((p) => ({ ...p, barangay: "" })); }}
              placeholder={city ? "Type barangay name" : "Select city first"}
              disabled={loading || !city}
              className={errors.barangay ? "border-destructive" : ""}
            />
          )}
        </Field>

        <Field label="Street" full error={errors.street}>
          <Input value={street} onChange={(e) => { setStreet(e.target.value); setErrors((p) => ({ ...p, street: "" })); }}
            placeholder="e.g. 123 Rizal St." disabled={loading}
            className={errors.street ? "border-destructive" : ""} />
        </Field>

        <Field label="Client type">
          <Select value={type} onValueChange={setType} disabled={loading}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New Loan</SelectItem>
              <SelectItem value="renew">Reloan</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Assigned collector" error={errors.collectorId}>
          <Select value={collectorId} onValueChange={(v) => { setCollectorId(v); setErrors((p) => ({ ...p, collectorId: "" })); }} disabled={loading}>
            <SelectTrigger className={errors.collectorId ? "border-destructive" : ""}><SelectValue placeholder="Select collector" /></SelectTrigger>
            <SelectContent>
              {collectors.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">— {c.area}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Latitude (optional)" error={errors.latitude}>
          <Input type="number" step="any" value={latitude}
            onChange={(e) => { setLatitude(e.target.value); setErrors((p) => ({ ...p, latitude: "" })); }}
            placeholder="e.g. 14.5995" disabled={loading}
            className={errors.latitude ? "border-destructive" : ""} />
        </Field>

        <Field label="Longitude (optional)" error={errors.longitude}>
          <Input type="number" step="any" value={longitude}
            onChange={(e) => { setLongitude(e.target.value); setErrors((p) => ({ ...p, longitude: "" })); }}
            placeholder="e.g. 120.9842" disabled={loading}
            className={errors.longitude ? "border-destructive" : ""} />
        </Field>

      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onCancel} disabled={loading} className="sm:mr-auto">Cancel</Button>
        <Button variant="outline" onClick={() => submit(false)} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save client
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={() => submit(true)} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
          Save & Create Loan
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------- Edit Client Dialog ---------- */
interface EditClientDialogProps {
  client: Client;
  collectors: Collector[];
  token?: string;
  onSaved: () => void;
  onCancel: () => void;
}

function parseAddress(addr: string) {
  const parts = addr.split(", ").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const province = parts[parts.length - 1];
    const city     = parts[parts.length - 2];
    if (PH_PROVINCES.includes(province) && (PH_CITIES[province] ?? []).includes(city)) {
      const rest = parts.slice(0, parts.length - 2);
      // rest = [street] or [street, barangay] or [street, oldSubdivision]
      return {
        street:   rest[0] ?? "",
        barangay: rest.length >= 2 ? rest[rest.length - 1] : "",
        city,
        province,
      };
    }
  }
  return { street: addr, barangay: "", city: "", province: "" };
}

function EditClientDialog({ client, collectors, token, onSaved, onCancel }: EditClientDialogProps) {
  const parsed = parseAddress(client.address);
  const [firstName, setFirstName]   = useState(client.first_name ?? client.name.split(" ")[0]);
  const [middleName, setMiddleName] = useState(client.middle_name ?? "");
  const [lastName, setLastName]     = useState(client.last_name ?? client.name.split(" ").slice(1).join(" "));
  const [phone, setPhone]           = useState(client.phone.replace(/^\+?63/, "").replace(/^0/, ""));
  const [storeName, setStoreName] = useState(client.store_name);
  const [email, setEmail]         = useState(client.email ?? "");
  const [province, setProvince]       = useState(parsed.province);
  const [city, setCity]               = useState(parsed.city);
  const [barangay, setBarangay]       = useState(parsed.barangay);
  const [street, setStreet]           = useState(parsed.street);
  const [type, setType]           = useState(client.type);
  const [status, setStatus]       = useState(client.status);
  const [collectorId, setCollectorId] = useState(String(client.collector_id));
  const [latitude, setLatitude]   = useState(client.latitude != null ? String(client.latitude) : "");
  const [longitude, setLongitude] = useState(client.longitude != null ? String(client.longitude) : "");
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "First name is required.";
    if (!lastName.trim())  e.lastName  = "Last name / Surname is required.";
    if (!phone.trim())     e.phone     = "Cellphone number is required.";
    else if (phone.replace(/\D/g, "").length !== 10) e.phone = "Enter 10 digits after +63.";
    if (!storeName.trim()) e.storeName = "Store name is required.";
    if (!province)         e.province  = "Province is required.";
    if (!city)             e.city      = "City / Municipality is required.";
    if (!barangay.trim())  e.barangay  = "Barangay is required.";
    if (!street.trim())    e.street    = "Street is required.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                           e.email     = "Invalid email address.";
    if (latitude && (isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90))
                           e.latitude  = "Must be between -90 and 90.";
    if (longitude && (isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180))
                           e.longitude = "Must be between -180 and 180.";
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    const localPhone  = "0" + phone.replace(/\D/g, "");
    const fullAddress = [street.trim(), barangay.trim(), city, province].filter(Boolean).join(", ");

    setLoading(true);
    try {
      await apiRequest("PATCH", `clients/${client.id}`, {
        token,
        body: {
          first_name:   firstName.trim(),
          middle_name:  middleName.trim() || null,
          last_name:    lastName.trim(),
          phone:        localPhone,
          store_name:   storeName.trim(),
          email:        email.trim() || null,
          address:      fullAddress,
          type,
          status,
          collector_id: Number(collectorId),
          latitude:     latitude ? Number(latitude) : null,
          longitude:    longitude ? Number(longitude) : null,
        },
      });
      toast.success("Client updated!", { description: `${[firstName.trim(), lastName.trim()].join(" ")} has been updated.` });
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update client.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Edit client — {client.number}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <Field label="First name" error={errors.firstName}>
          <Input value={firstName} onChange={(e) => { setFirstName(e.target.value.toUpperCase()); setErrors((p) => ({ ...p, firstName: "" })); }}
            placeholder="JUAN" disabled={loading} className={errors.firstName ? "border-destructive uppercase" : "uppercase"} />
        </Field>

        <Field label="Last name / Surname" error={errors.lastName}>
          <Input value={lastName} onChange={(e) => { setLastName(e.target.value.toUpperCase()); setErrors((p) => ({ ...p, lastName: "" })); }}
            placeholder="DELA CRUZ" disabled={loading} className={errors.lastName ? "border-destructive uppercase" : "uppercase"} />
        </Field>

        <Field label="Middle name (optional)" full>
          <Input value={middleName} onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
            placeholder="SANTOS" disabled={loading} className="uppercase" />
        </Field>

        <Field label="Cellphone number" error={errors.phone}>
          <div className={`flex h-9 w-full overflow-hidden rounded-md border bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${errors.phone ? "border-destructive" : "border-input"}`}>
            <span className="flex items-center border-r bg-muted px-3 text-muted-foreground select-none">+63</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, "")); setErrors((p) => ({ ...p, phone: "" })); }}
              placeholder="917 000 0000"
              disabled={loading}
              className="flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </Field>

        <Field label="Store / Business name" error={errors.storeName}>
          <Input value={storeName} onChange={(e) => { setStoreName(e.target.value.toUpperCase()); setErrors((p) => ({ ...p, storeName: "" })); }}
            placeholder="JUAN SARI-SARI STORE" disabled={loading} className={errors.storeName ? "border-destructive uppercase" : "uppercase"} />
        </Field>

        <Field label="Email address (optional)" error={errors.email}>
          <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
            placeholder="client@email.com" disabled={loading} className={errors.email ? "border-destructive" : ""} />
        </Field>

        <Field label="Province" error={errors.province}>
          <SearchableCombobox
            options={PH_PROVINCES.map((p) => ({ value: p, label: p }))}
            value={province}
            onChange={(v) => { setProvince(v); setCity(""); setBarangay(""); setErrors((p) => ({ ...p, province: "" })); }}
            placeholder="Search province…"
            error={!!errors.province}
            disabled={loading}
          />
        </Field>

        <Field label="City / Municipality" error={errors.city}>
          <SearchableCombobox
            options={(PH_CITIES[province] ?? []).map((c) => ({ value: c, label: c }))}
            value={city}
            onChange={(v) => { setCity(v); setBarangay(""); setErrors((p) => ({ ...p, city: "" })); }}
            placeholder={province ? "Search city…" : "Select province first"}
            error={!!errors.city}
            disabled={loading || !province}
          />
        </Field>

        <Field label="Barangay" full error={errors.barangay}>
          {getBarangays(province, city).length > 0 ? (
            <SearchableCombobox
              options={getBarangays(province, city).map((b) => ({ value: b, label: b }))}
              value={barangay}
              onChange={(v) => { setBarangay(v); setErrors((p) => ({ ...p, barangay: "" })); }}
              placeholder={city ? "Search barangay…" : "Select city first"}
              error={!!errors.barangay}
              disabled={loading || !city}
            />
          ) : (
            <Input
              value={barangay}
              onChange={(e) => { setBarangay(e.target.value); setErrors((p) => ({ ...p, barangay: "" })); }}
              placeholder={city ? "Type barangay name" : "Select city first"}
              disabled={loading || !city}
              className={errors.barangay ? "border-destructive" : ""}
            />
          )}
        </Field>

        <Field label="Street" full error={errors.street}>
          <Input value={street} onChange={(e) => { setStreet(e.target.value); setErrors((p) => ({ ...p, street: "" })); }}
            placeholder="e.g. 123 Rizal St." disabled={loading}
            className={errors.street ? "border-destructive" : ""} />
        </Field>

        <Field label="Client type">
          <Select value={type} onValueChange={setType} disabled={loading}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New Loan</SelectItem>
              <SelectItem value="renew">Reloan</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status">
          <Select value={status} onValueChange={setStatus} disabled={loading}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="renew">Renew</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="past-due">Past Due</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Assigned collector">
          <Select value={collectorId} onValueChange={setCollectorId} disabled={loading}>
            <SelectTrigger><SelectValue placeholder="Select collector" /></SelectTrigger>
            <SelectContent>
              {collectors.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">— {c.area}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Latitude (optional)" error={errors.latitude}>
          <Input type="number" step="any" value={latitude}
            onChange={(e) => { setLatitude(e.target.value); setErrors((p) => ({ ...p, latitude: "" })); }}
            placeholder="e.g. 14.5995" disabled={loading}
            className={errors.latitude ? "border-destructive" : ""} />
        </Field>

        <Field label="Longitude (optional)" error={errors.longitude}>
          <Input type="number" step="any" value={longitude}
            onChange={(e) => { setLongitude(e.target.value); setErrors((p) => ({ ...p, longitude: "" })); }}
            placeholder="e.g. 120.9842" disabled={loading}
            className={errors.longitude ? "border-destructive" : ""} />
        </Field>

      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading} className="mr-auto">Cancel</Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------- Email Dialog ---------- */
function EmailDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const [templateKey, setTemplateKey] = useState<keyof typeof EMAIL_TEMPLATES>("reminder");
  const template = EMAIL_TEMPLATES[templateKey];
  const [subject, setSubject] = useState(template.subject());
  const [body, setBody] = useState(template.body(client.name));

  function handleTemplateChange(key: keyof typeof EMAIL_TEMPLATES) {
    setTemplateKey(key);
    setSubject(EMAIL_TEMPLATES[key].subject());
    setBody(EMAIL_TEMPLATES[key].body(client.name));
  }

  function handleSend() {
    toast.success(`Email sent to ${client.email}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-info" />Email — {client.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">To: {client.email}</p>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Template">
            <Select value={templateKey} onValueChange={(v) => handleTemplateChange(v as keyof typeof EMAIL_TEMPLATES)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EMAIL_TEMPLATES).map(([k, t]) => (
                  <SelectItem key={k} value={k}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message">
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} className="text-sm" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-info text-white hover:bg-info/90" onClick={handleSend}>
            <Mail className="mr-1.5 h-4 w-4" />Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- ClientSortHead ---------- */
type ClientSortCol = "number" | "name" | "store_name" | "created_at";
function ClientSortHead({ col, label, sort, dir, onSort }: {
  col: ClientSortCol; label: string;
  sort: ClientSortCol | null; dir: "asc" | "desc";
  onSort: (col: ClientSortCol) => void;
}) {
  const active = sort === col;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors hover:text-foreground ${active ? "text-foreground font-semibold" : "text-muted-foreground font-normal"}`}
      >
        {label}<Icon className="h-3 w-3 shrink-0" />
      </button>
    </TableHead>
  );
}

/* ---------- Field ---------- */
function Field({ label, full, error, children }: { label: string; full?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
