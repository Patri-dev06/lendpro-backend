import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, Plus, Pencil, Trash2, Loader2, Search, Phone, MapPin, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { PH_PROVINCES, PH_CITIES } from "@/lib/ph-locations";
import { getBarangays } from "@/lib/ph-barangays";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP } from "@/lib/format";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/shared/AccessRestricted";

interface Collector {
  id: number;
  name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  code: string;
  area: string;
  phone: string | null;
  address: string | null;
  mothers_name: string | null;
  fathers_name: string | null;
  place_of_birth: string | null;
  date_of_birth: string | null;
  fb_messenger: string | null;
  email: string | null;
  drivers_license: string | null;
  approval_status: string;
  assigned: number;
  expected: number;
  actual: number;
  missed: number;
  overdue: number;
  past_due: number;
}

export const Route = createFileRoute("/_app/collectors/")({
  head: () => ({ meta: [{ title: "Collectors — BuenaMano" }] }),
  component: CollectorsPage,
});

function CollectorsPage() {
  const { token, role } = useRole();
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading]       = useState(true);
  const [q, setQ]                   = useState("");
  const [addOpen, setAddOpen]       = useState(false);
  const [editTarget, setEditTarget] = useState<Collector | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collector | null>(null);
  const [approvingId, setApprovingId]   = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Collector | null>(null);
  const [rejecting, setRejecting]       = useState(false);

  const fetchCollectors = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Collector[]>("GET", "collectors", { token });
      setCollectors(data);
    } catch {
      toast.error("Failed to load collectors.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCollectors(); }, [fetchCollectors]);

  async function handleApprove(c: Collector) {
    setApprovingId(c.id);
    try {
      await apiRequest("POST", `collectors/${c.id}/approve`, { token: token ?? undefined });
      toast.success(`${c.name} approved.`);
      fetchCollectors();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve collector.");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget || !token) return;
    setRejecting(true);
    try {
      await apiRequest("POST", `collectors/${rejectTarget.id}/reject`, { token });
      toast.success(`${rejectTarget.name} rejected and removed.`);
      setRejectTarget(null);
      fetchCollectors();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject collector.");
    } finally {
      setRejecting(false);
    }
  }

  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const headers = ["ID", "Collector Name", "Area", "Phone", "Assigned", "Expected (₱)", "Actual (₱)", "Rate (%)"];
    const rows = collectors.map((c) => {
      const rate = c.expected > 0 ? Math.round((c.actual / c.expected) * 100) : 0;
      return [c.code, c.name, c.area, c.phone ?? "", c.assigned, c.expected, c.actual, rate].join(",");
    });
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `collector-summary-${today}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Collector summary downloaded.");
  }

  async function handleDelete() {
    if (!deleteTarget || !token) return;
    try {
      await apiRequest("DELETE", `collectors/${deleteTarget.id}`, { token });
      setCollectors((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} removed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete collector.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const pendingCount = collectors.filter((c) => c.approval_status === "pending_approval").length;

  const filtered = collectors.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.code.toLowerCase().includes(q.toLowerCase()) ||
    c.area.toLowerCase().includes(q.toLowerCase()) ||
    (c.phone ?? "").includes(q)
  );

  return (
    <PermissionGuard permission="collectors:read">
    <div className="space-y-6">
      <PageHeader
        title="Collectors"
        subtitle="Field collection team and performance overview."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadCSV} disabled={loading}>
              <Download className="mr-2 h-4 w-4" />Download Summary
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Add collector
            </Button>
          </div>
        }
      />

      {/* Pending approval banner — admin only */}
      {role === "admin" && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-medium text-amber-800 dark:text-amber-300">
            {pendingCount} collector{pendingCount > 1 ? "s" : ""} pending approval
          </span>
          <span className="text-amber-600 dark:text-amber-500 text-xs">
            Review and approve or reject duplicate registrations below.
          </span>
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8 h-9 text-sm" placeholder="Search collectors…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
        <Table className="min-w-200">
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">Loading collectors…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                {collectors.length === 0 ? "No collectors yet." : "No results match your search."}
              </td></tr>
            ) : filtered.map((c) => {
              const rate = c.expected > 0 ? Math.round((c.actual / c.expected) * 100) : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.code}</TableCell>
                  <TableCell>
                    <Link
                      to="/collectors/$id"
                      params={{ id: String(c.id) }}
                      className="font-medium hover:text-primary hover:underline underline-offset-4 transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.approval_status === "pending_approval" && (
                      <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" />Pending Approval
                      </div>
                    )}
                    {c.address && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-40">{c.address}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{c.area}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />{c.phone}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right num">{c.assigned}</TableCell>
                  <TableCell className="text-right num">{formatPHP(c.expected)}</TableCell>
                  <TableCell className="text-right num">{formatPHP(c.actual)}</TableCell>
                  <TableCell className={`text-right num font-semibold ${rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-destructive"}`}>
                    {rate}%
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
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditTarget(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CollectorFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        token={token}
        onSaved={(c) => { setCollectors((prev) => [...prev, c]); setAddOpen(false); }}
      />

      <CollectorFormDialog
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        token={token}
        collector={editTarget ?? undefined}
        onSaved={(c) => { setCollectors((prev) => prev.map((x) => x.id === c.id ? c : x)); setEditTarget(null); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove collector?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}) from the system. Their assigned clients will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject collector confirmation */}
      {rejectTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Duplicate Collector</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <p>Permanently remove this collector registration? This cannot be undone.</p>
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{rejectTarget.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Area</span>
                  <span className="font-medium">{rejectTarget.area}</span>
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

/* ---------- Address parser ---------- */
function parseAddress(addr: string) {
  if (!addr) return { street: "", barangay: "", city: "", province: "" };
  const parts = addr.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    const province = parts[parts.length - 1];
    const city     = parts[parts.length - 2];
    if (PH_PROVINCES.includes(province) && (PH_CITIES[province] ?? []).includes(city)) {
      const rest = parts.slice(0, parts.length - 2);
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

/* ---------- Form dialog ---------- */
interface FormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  collector?: Collector;
  onSaved: (c: Collector) => void;
}

function CollectorFormDialog({ open, onOpenChange, token, collector, onSaved }: FormDialogProps) {
  const editing = !!collector;

  const [firstName, setFirstName]   = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName]     = useState("");
  const [area, setArea]             = useState("");
  const [phone, setPhone]           = useState("");
  const [province, setProvince]     = useState("");
  const [city, setCity]             = useState("");
  const [barangay, setBarangay]     = useState("");
  const [street, setStreet]         = useState("");
  const [mothersName, setMothersName] = useState("");
  const [fathersName, setFathersName] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [dateOfBirth, setDateOfBirth]   = useState("");
  const [fbMessenger, setFbMessenger]   = useState("");
  const [email, setEmail]           = useState("");
  const [driversLicense, setDriversLicense] = useState("");
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const parts = (collector?.name ?? "").split(" ");
      setFirstName(collector?.first_name ?? parts[0] ?? "");
      setLastName(collector?.last_name ?? (parts.length > 1 ? parts[parts.length - 1] : ""));
      setMiddleName(collector?.middle_name ?? (parts.length > 2 ? parts.slice(1, -1).join(" ") : ""));
      setArea(collector?.area ?? "");
      setPhone(collector?.phone?.replace(/^\+?63/, "").replace(/^0/, "") ?? "");
      const parsed = parseAddress(collector?.address ?? "");
      setProvince(parsed.province);
      setCity(parsed.city);
      setBarangay(parsed.barangay);
      setStreet(parsed.street);
      setMothersName(collector?.mothers_name ?? "");
      setFathersName(collector?.fathers_name ?? "");
      setPlaceOfBirth(collector?.place_of_birth ?? "");
      setDateOfBirth(collector?.date_of_birth ?? "");
      setFbMessenger(collector?.fb_messenger ?? "");
      setEmail(collector?.email ?? "");
      setDriversLicense(collector?.drivers_license ?? "");
      setErrors({});
    }
  }, [open, collector]);

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim())     e.firstName    = "Given name is required.";
    if (!lastName.trim())      e.lastName     = "Surname is required.";
    if (!area.trim())          e.area         = "Area / route is required.";
    if (!province)             e.province     = "Province is required.";
    if (!city)                 e.city         = "City / Municipality is required.";
    if (!barangay.trim())      e.barangay     = "Barangay is required.";
    if (!phone.trim())         e.phone        = "Cellphone number is required.";
    else if (phone.replace(/\D/g, "").length !== 10) e.phone = "Enter 10 digits after +63.";
    if (!mothersName.trim())   e.mothersName  = "Mother's name is required.";
    if (!fathersName.trim())   e.fathersName  = "Father's name is required.";
    if (!placeOfBirth.trim())  e.placeOfBirth = "Place of birth is required.";
    if (!dateOfBirth)          e.dateOfBirth  = "Date of birth is required.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate() || !token) return;
    setSaving(true);
    try {
      const localPhone  = "0" + phone.replace(/\D/g, "");
      const fullAddress = [street.trim(), barangay.trim(), city, province].filter(Boolean).join(", ");
      const body = {
        first_name:      firstName.trim(),
        middle_name:     middleName.trim() || null,
        last_name:       lastName.trim(),
        area:            area.trim(),
        phone:           localPhone,
        address:         fullAddress,
        mothers_name:    mothersName.trim(),
        fathers_name:    fathersName.trim(),
        place_of_birth:  placeOfBirth.trim(),
        date_of_birth:   dateOfBirth,
        fb_messenger:    fbMessenger.trim() || null,
        email:           email.trim() || null,
        drivers_license: driversLicense.trim() || null,
      };
      const saved = editing
        ? await apiRequest<Collector>("PATCH", `collectors/${collector!.id}`, { token, body })
        : await apiRequest<Collector>("POST", "collectors", { token, body });

      if (!editing && saved.approval_status === "pending_approval") {
        toast.warning("Collector saved — pending approval", {
          description: "A collector with the same name already exists. An Administrator must approve this registration.",
        });
      } else {
        toast.success(editing ? "Collector updated." : `Collector added — ID: ${saved.code}`);
      }
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function clrErr(key: string) {
    setErrors((x) => ({ ...x, [key]: "" }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit collector — ${collector!.code}` : "Add new collector"}
          </DialogTitle>
          {editing && (
            <p className="text-xs text-muted-foreground">ID is auto-assigned and cannot be changed.</p>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-1">

          <FF label="Given name" error={errors.firstName}>
            <Input value={firstName}
              onChange={(e) => { setFirstName(e.target.value.toUpperCase()); clrErr("firstName"); }}
              placeholder="MARIA" disabled={saving}
              className={`uppercase ${errors.firstName ? "border-destructive" : ""}`} />
          </FF>

          <FF label="Surname" error={errors.lastName}>
            <Input value={lastName}
              onChange={(e) => { setLastName(e.target.value.toUpperCase()); clrErr("lastName"); }}
              placeholder="SANTOS" disabled={saving}
              className={`uppercase ${errors.lastName ? "border-destructive" : ""}`} />
          </FF>

          <FF label="Middle name (optional)" full>
            <Input value={middleName}
              onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
              placeholder="DELA CRUZ" disabled={saving}
              className="uppercase" />
          </FF>

          <FF label="Area / Route" error={errors.area}>
            <Input value={area}
              onChange={(e) => { setArea(e.target.value.toUpperCase()); clrErr("area"); }}
              placeholder="POBLACION ZONE 1" disabled={saving}
              className={`uppercase ${errors.area ? "border-destructive" : ""}`} />
          </FF>

          <FF label="Cellphone number" error={errors.phone}>
            <div className={`flex h-9 w-full overflow-hidden rounded-md border bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${errors.phone ? "border-destructive" : "border-input"}`}>
              <span className="flex items-center border-r bg-muted px-3 text-muted-foreground select-none">+63</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, "")); clrErr("phone"); }}
                placeholder="917 000 0000"
                disabled={saving}
                className="flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </FF>

          <FF label="Email address (optional)" error={errors.email}>
            <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clrErr("email"); }}
              placeholder="collector@email.com" disabled={saving} className={errors.email ? "border-destructive" : ""} />
          </FF>

          <FF label="Province" error={errors.province}>
            <SearchableCombobox
              options={PH_PROVINCES.map((p) => ({ value: p, label: p }))}
              value={province}
              onChange={(v) => { setProvince(v); setCity(""); setBarangay(""); clrErr("province"); }}
              placeholder="Search province…"
              error={!!errors.province}
              disabled={saving}
            />
          </FF>

          <FF label="City / Municipality" error={errors.city}>
            <SearchableCombobox
              options={(PH_CITIES[province] ?? []).map((c) => ({ value: c, label: c }))}
              value={city}
              onChange={(v) => { setCity(v); setBarangay(""); clrErr("city"); }}
              placeholder={province ? "Search city…" : "Select province first"}
              error={!!errors.city}
              disabled={saving || !province}
            />
          </FF>

          <FF label="Barangay" error={errors.barangay} full>
            {getBarangays(province, city).length > 0 ? (
              <SearchableCombobox
                options={getBarangays(province, city).map((b) => ({ value: b, label: b }))}
                value={barangay}
                onChange={(v) => { setBarangay(v); clrErr("barangay"); }}
                placeholder={city ? "Search barangay…" : "Select city first"}
                error={!!errors.barangay}
                disabled={saving || !city}
              />
            ) : (
              <Input
                value={barangay}
                onChange={(e) => { setBarangay(e.target.value.toUpperCase()); clrErr("barangay"); }}
                placeholder={city ? "Type barangay name" : "Select city first"}
                disabled={saving || !city}
                className={`uppercase ${errors.barangay ? "border-destructive" : ""}`}
              />
            )}
          </FF>

          <FF label="Street (optional)" full>
            <Input value={street}
              onChange={(e) => setStreet(e.target.value.toUpperCase())}
              placeholder="HOUSE NO. / STREET NAME"
              disabled={saving} className="uppercase" />
          </FF>

          <FF label="Mother's full name" error={errors.mothersName}>
            <Input value={mothersName}
              onChange={(e) => { setMothersName(e.target.value.toUpperCase()); clrErr("mothersName"); }}
              placeholder="ANA SANTOS" disabled={saving}
              className={`uppercase ${errors.mothersName ? "border-destructive" : ""}`} />
          </FF>

          <FF label="Father's full name" error={errors.fathersName}>
            <Input value={fathersName}
              onChange={(e) => { setFathersName(e.target.value.toUpperCase()); clrErr("fathersName"); }}
              placeholder="JOSE SANTOS" disabled={saving}
              className={`uppercase ${errors.fathersName ? "border-destructive" : ""}`} />
          </FF>

          <FF label="Place of birth" error={errors.placeOfBirth}>
            <Input value={placeOfBirth}
              onChange={(e) => { setPlaceOfBirth(e.target.value.toUpperCase()); clrErr("placeOfBirth"); }}
              placeholder="BUENAVISTA, AGUSAN DEL NORTE" disabled={saving}
              className={`uppercase ${errors.placeOfBirth ? "border-destructive" : ""}`} />
          </FF>

          <FF label="Date of birth" error={errors.dateOfBirth}>
            <Input type="date" value={dateOfBirth} onChange={(e) => { setDateOfBirth(e.target.value); clrErr("dateOfBirth"); }}
              disabled={saving} className={errors.dateOfBirth ? "border-destructive" : ""} />
          </FF>

          <FF label="FB Messenger (optional)">
            <Input value={fbMessenger} onChange={(e) => setFbMessenger(e.target.value)}
              placeholder="facebook.com/username" disabled={saving} />
          </FF>

          <FF label="Driver's License No. (optional)">
            <Input value={driversLicense} onChange={(e) => setDriversLicense(e.target.value.toUpperCase())}
              placeholder="N01-00-000000" disabled={saving} className="uppercase" />
          </FF>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add collector"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FF({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
