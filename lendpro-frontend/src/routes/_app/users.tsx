import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Search, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { PH_PROVINCES, PH_CITIES } from "@/lib/ph-locations";
import { getBarangays } from "@/lib/ph-barangays";
import { apiRequest } from "@/lib/api";
import { useRole, ROLE_LABELS, type Role } from "@/lib/role-context";
import { PermissionGuard } from "@/components/shared/AccessRestricted";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

interface SystemUser {
  id: number;
  name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  address: string | null;
  email: string;
  role: Role;
  is_approved: boolean;
  created_at: string;
}

const PW_RULES = [
  { label: "At least 8 characters",      test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)",  test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)",  test: (p: string) => /[a-z]/.test(p) },
  { label: "One number (0–9)",            test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character (!@#…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "User Management — BuenaMano" }] }),
  component: UsersPage,
});

function UsersPage() {
  const { token, user: currentUser } = useRole();
  const [users, setUsers]           = useState<SystemUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [q, setQ]                   = useState("");
  const [addOpen, setAddOpen]       = useState(false);
  const [editTarget, setEditTarget] = useState<SystemUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<SystemUser[]>("GET", "users", { token });
      setUsers(data);
    } catch {
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleApprove(u: SystemUser) {
    if (!token) return;
    setApprovingId(u.id);
    try {
      const updated = await apiRequest<SystemUser>("PATCH", `users/${u.id}/approve`, { token });
      setUsers((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      toast.success(`${u.name}'s account has been approved.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve user.");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    try {
      await apiRequest("DELETE", `users/${deleteTarget.id}`, { token });
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} has been removed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const pendingCount = users.filter((u) => !u.is_approved).length;

  const filtered = users.filter((u) =>
    !q ||
    u.name.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    ROLE_LABELS[u.role]?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <PermissionGuard permission="users:read">
    <div className="space-y-6">
      <PageHeader
        title="User management"
        subtitle={pendingCount > 0 ? `${pendingCount} account${pendingCount > 1 ? "s" : ""} pending approval` : "Manage system users, roles, and access."}
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add user
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8 h-9 text-sm" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Loading users…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                {users.length === 0 ? "No users found." : "No users match your search."}
              </td></tr>
            ) : filtered.map((u) => (
              <TableRow key={u.id} className={!u.is_approved ? "bg-amber-50/50" : undefined}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.id === currentUser?.id && (
                    <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">you</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                <TableCell>
                  <span className="rounded-full border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </TableCell>
                <TableCell>
                  {u.is_approved ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Pending approval</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!u.is_approved && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        disabled={approvingId === u.id}
                        onClick={() => handleApprove(u)}
                        title="Approve account"
                      >
                        {approvingId === u.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <CheckCircle className="h-3.5 w-3.5" />}
                        <span className="ml-1">Approve</span>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditTarget(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      disabled={u.id === currentUser?.id}
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add dialog */}
      <UserFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        token={token}
        onSaved={(u) => { setUsers((prev) => [u, ...prev]); setAddOpen(false); }}
      />

      {/* Edit dialog */}
      <UserFormDialog
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        token={token}
        user={editTarget ?? undefined}
        onSaved={(u) => { setUsers((prev) => prev.map((x) => x.id === u.id ? u : x)); setEditTarget(null); }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and revoke all their active sessions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove user
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PermissionGuard>
  );
}

/* ---------- User form dialog (add / edit) ---------- */
interface UserFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  user?: SystemUser;
  onSaved: (u: SystemUser) => void;
}

function UserFormDialog({ open, onOpenChange, token, user, onSaved }: UserFormProps) {
  const editing = !!user;

  const [firstName, setFirstName]   = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName]     = useState("");
  const [contactName, setContactName] = useState("");
  const [province, setProvince]     = useState("");
  const [city, setCity]             = useState("");
  const [barangay, setBarangay]     = useState("");
  const [street, setStreet]         = useState("");
  const [email, setEmail]           = useState("");
  const [role, setRole]             = useState<Role>("collector");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const parts = (user?.name ?? "").split(" ");
      setFirstName(user?.first_name ?? parts[0] ?? "");
      setLastName(user?.last_name ?? (parts.length > 1 ? parts[parts.length - 1] : ""));
      setMiddleName(user?.middle_name ?? (parts.length > 2 ? parts.slice(1, -1).join(" ") : ""));
      setContactName(user?.contact_name ?? "");
      const parsed = parseUserAddress(user?.address ?? "");
      setProvince(parsed.province); setCity(parsed.city);
      setBarangay(parsed.barangay); setStreet(parsed.street);
      setEmail(user?.email ?? "");
      setRole(user?.role ?? "collector");
      setPassword(""); setConfirm("");
      setShowPw(false); setShowConfirm(false);
      setErrors({});
    }
  }, [open, user]);

  const pwValid  = !password || PW_RULES.every((r) => r.test(password));
  const mismatch = !!confirm && password !== confirm;

  function clrErr(key: string) { setErrors((x) => ({ ...x, [key]: "" })); }

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim())  e.firstName = "Given name is required.";
    if (!lastName.trim())   e.lastName  = "Surname is required.";
    if (!province)          e.province  = "Province is required.";
    if (!city)              e.city      = "City / Municipality is required.";
    if (!barangay.trim())   e.barangay  = "Barangay is required.";
    if (!email.trim())      e.email     = "Email is required.";
    if (!editing && !password)             e.password = "Password is required.";
    if (!editing && password && !pwValid)  e.password = "Password does not meet requirements.";
    if ((password || confirm) && mismatch) e.confirm  = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate() || !token) return;
    setSaving(true);
    try {
      const fullAddress = [street.trim(), barangay.trim(), city, province].filter(Boolean).join(", ");
      const body: Record<string, unknown> = {
        first_name:   firstName.trim(),
        middle_name:  middleName.trim() || null,
        last_name:    lastName.trim(),
        contact_name: contactName.trim() || null,
        address:      fullAddress || null,
        email:        email.trim(),
        role,
      };
      if (password) { body.password = password; body.password_confirmation = confirm; }

      const saved = editing
        ? await apiRequest<SystemUser>("PATCH", `users/${user!.id}`, { token, body })
        : await apiRequest<SystemUser>("POST", "users", { token, body });

      toast.success(editing ? "User updated." : "User created.", {
        description: editing ? `${saved.name}'s profile has been updated.` : `${saved.name} has been added and can now sign in.`,
      });
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Add new user"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-1">

          <FormField label="Given name" error={errors.firstName}>
            <Input value={firstName}
              onChange={(e) => { setFirstName(e.target.value.toUpperCase()); clrErr("firstName"); }}
              placeholder="JUAN" className={`uppercase ${errors.firstName ? "border-destructive" : ""}`} />
          </FormField>

          <FormField label="Surname" error={errors.lastName}>
            <Input value={lastName}
              onChange={(e) => { setLastName(e.target.value.toUpperCase()); clrErr("lastName"); }}
              placeholder="DELA CRUZ" className={`uppercase ${errors.lastName ? "border-destructive" : ""}`} />
          </FormField>

          <FormField label="Middle name (optional)" full>
            <Input value={middleName}
              onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
              placeholder="SANTOS" className="uppercase" />
          </FormField>

          <FormField label="Contact person (optional)" full>
            <Input value={contactName}
              onChange={(e) => setContactName(e.target.value.toUpperCase())}
              placeholder="Emergency contact name" className="uppercase" />
          </FormField>

          <FormField label="Province" error={errors.province}>
            <SearchableCombobox
              options={PH_PROVINCES.map((p) => ({ value: p, label: p }))}
              value={province}
              onChange={(v) => { setProvince(v); setCity(""); setBarangay(""); clrErr("province"); }}
              placeholder="Search province…"
              error={!!errors.province}
            />
          </FormField>

          <FormField label="City / Municipality" error={errors.city}>
            <SearchableCombobox
              options={(PH_CITIES[province] ?? []).map((c) => ({ value: c, label: c }))}
              value={city}
              onChange={(v) => { setCity(v); setBarangay(""); clrErr("city"); }}
              placeholder={province ? "Search city…" : "Select province first"}
              error={!!errors.city}
              disabled={!province}
            />
          </FormField>

          <FormField label="Barangay" error={errors.barangay} full>
            {getBarangays(province, city).length > 0 ? (
              <SearchableCombobox
                options={getBarangays(province, city).map((b) => ({ value: b, label: b }))}
                value={barangay}
                onChange={(v) => { setBarangay(v); clrErr("barangay"); }}
                placeholder={city ? "Search barangay…" : "Select city first"}
                error={!!errors.barangay}
                disabled={!city}
              />
            ) : (
              <Input value={barangay}
                onChange={(e) => { setBarangay(e.target.value.toUpperCase()); clrErr("barangay"); }}
                placeholder={city ? "Type barangay name" : "Select city first"}
                disabled={!city}
                className={`uppercase ${errors.barangay ? "border-destructive" : ""}`} />
            )}
          </FormField>

          <FormField label="Street (optional)" full>
            <Input value={street}
              onChange={(e) => setStreet(e.target.value.toUpperCase())}
              placeholder="HOUSE NO. / STREET NAME" className="uppercase" />
          </FormField>

          <FormField label="Email" error={errors.email} full>
            <Input type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); clrErr("email"); }}
              placeholder="user@buenamano.ph"
              className={errors.email ? "border-destructive" : ""} />
          </FormField>

          <FormField label="Role" full>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, l]) => (
                  <SelectItem key={r} value={r}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="sm:col-span-2 pt-1 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              {editing ? "Change password (leave blank to keep current)" : "Password"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Password" error={errors.password}>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password}
                    onChange={(e) => { setPassword(e.target.value); clrErr("password"); }}
                    className={`pr-10 ${password && !pwValid ? "border-amber-400" : ""}`}
                    placeholder={editing ? "New password (optional)" : "Create a strong password"} />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <ul className="mt-1.5 space-y-0.5">
                    {PW_RULES.map((r) => {
                      const ok = r.test(password);
                      return (
                        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-600" : "text-muted-foreground"}`}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                          {r.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </FormField>
              <FormField label="Confirm password" error={errors.confirm}>
                <div className="relative">
                  <Input type={showConfirm ? "text" : "password"} value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); clrErr("confirm"); }}
                    className={`pr-10 ${mismatch ? "border-destructive" : ""}`}
                    placeholder="Re-enter password" />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseUserAddress(addr: string) {
  if (!addr) return { street: "", barangay: "", city: "", province: "" };
  const parts = addr.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    const province = parts[parts.length - 1];
    const city     = parts[parts.length - 2];
    if (PH_PROVINCES.includes(province) && (PH_CITIES[province] ?? []).includes(city)) {
      const rest = parts.slice(0, parts.length - 2);
      return { street: rest[0] ?? "", barangay: rest.length >= 2 ? rest[rest.length - 1] : "", city, province };
    }
  }
  return { street: addr, barangay: "", city: "", province: "" };
}

function FormField({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
