import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, TrendingUp, LineChart, Banknote, Eye, EyeOff, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole, ROLE_LABELS, type Role } from "@/lib/role-context";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("bm_token")) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Sign in — BuenaMano" }] }),
  component: LoginPage,
});

const STATS = [
  { label: "Collected today", value: "₱182,450", icon: TrendingUp },
  { label: "Outstanding", value: "₱1.74M", icon: LineChart },
  { label: "Overdue", value: "23 accts", icon: ShieldCheck },
  { label: "Active loans", value: "276", icon: Banknote },
];

function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* Left visual panel */}
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.50_0.18_260/0.5),transparent_55%),radial-gradient(circle_at_bottom_right,oklch(0.55_0.20_295/0.35),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(var(--primary-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--primary-foreground) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative">
          <img src="/logo.png" alt="BuenaMano Lending Corporation" className="h-24 w-auto object-contain mix-blend-screen" />
        </div>

        <div className="relative space-y-8">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
              Loan Management & Collection Monitoring System
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">
              Run a tighter book.<br />Collect with confidence.
            </h1>
            <p className="mt-3 text-sm text-primary-foreground/75">
              Encode loans, generate daily collection schedules, and monitor every peso your collectors bring in — all from one operations console.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
            {STATS.map((m) => (
              <div key={m.label} className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-primary-foreground/60">{m.label}</span>
                  <m.icon className="h-3.5 w-3.5 opacity-70" />
                </div>
                <p className="mt-1 font-display text-lg font-semibold num">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} BuenaMano Lending Corporation · All rights reserved
        </p>
      </div>

      {/* Right form panel — scrollable, never stretches */}
      <div className="flex flex-col overflow-y-auto bg-background">
        {/* Mobile brand header */}
        <div className="flex shrink-0 justify-end px-6 pt-6 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 font-bold text-white text-sm select-none">
              BM
            </div>
            <div className="flex flex-col leading-tight">
              <div className="font-display text-sm font-bold">
                <span className="text-amber-500">Buena</span><span className="text-blue-600">Mano</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Lending Corporation</span>
            </div>
          </div>
        </div>

        {/* Form — centered vertically with flex-1, scrolls naturally */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-sm">
            {mode === "login" ? (
              <LoginForm onSwitch={() => setMode("register")} />
            ) : (
              <RegisterForm onSwitch={() => setMode("login")} />
            )}
          </div>
        </div>

        {/* Footer — pinned at bottom of scroll area */}
        <p className="shrink-0 px-6 pb-6 text-center text-xs text-muted-foreground">
          By continuing you agree to BuenaMano's{" "}
          <a href="#" className="underline">Terms</a> and{" "}
          <a href="#" className="underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

/* ---------- LOGIN FORM ---------- */
function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate();
  const { login } = useRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Sign in to your account</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter your credentials to access the operations console.</p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@buenamano.ph"
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              placeholder="Enter your password"
              required
              disabled={loading}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-glow"
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button onClick={onSwitch} className="font-medium text-primary hover:underline">
          Create account
        </button>
      </p>
    </>
  );
}

/* ---------- PASSWORD RULES ---------- */
const PW_RULES = [
  { label: "At least 8 characters",     test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number (0–9)",           test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character (!@#…)",test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
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
  );
}

/* ---------- REGISTER FORM ---------- */
function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { register } = useRole();
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("collector");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const pwValid   = PW_RULES.every((r) => r.test(password));
  const mismatch  = confirm.length > 0 && password !== confirm;
  const canSubmit = pwValid && !mismatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const mi   = middleInitial.trim() ? `${middleInitial.trim().charAt(0).toUpperCase()}.` : "";
    const name = [firstName.trim(), mi, lastName.trim()].filter(Boolean).join(" ");
    setError("");
    setLoading(true);
    try {
      await register(name, email, role, password, confirm);
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("already in use") || msg.toLowerCase().includes("already been taken")) {
        setError("This email is already in use. Please use a different email address.");
      } else if (msg.toLowerCase().includes("already exist") || msg.toLowerCase().includes("user already")) {
        setError("A user with this information already exists in the system.");
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">Registration submitted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account request has been sent to the administrator for review. You will be able to sign in once your account is approved.
        </p>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs text-amber-800">
          <p className="font-medium">What happens next?</p>
          <p className="mt-1">An admin will review your registration and approve or reject your account. Contact your system administrator if you need urgent access.</p>
        </div>
        <button
          onClick={onSwitch}
          className="mt-6 text-sm font-medium text-primary hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Create an account</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Fill in the details to register a new user.</p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="first-name">First name</Label>
          <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
            placeholder="Juan" required disabled={loading} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="middle-initial">Middle initial</Label>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <Input id="middle-initial" value={middleInitial} onChange={(e) => setMiddleInitial(e.target.value.slice(0, 1))}
            placeholder="Leave blank if none" maxLength={1} disabled={loading} className="uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name">Last name</Label>
          <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)}
            placeholder="dela Cruz" required disabled={loading} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Email</Label>
          <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="juan@buenamano.ph" required disabled={loading} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={loading}>
            <SelectTrigger id="reg-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                <SelectItem key={r} value={r}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-password">Password</Label>
          <div className="relative">
            <Input id="reg-password" type={showPw ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password"
              className={`pr-10 ${password && !pwValid ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
              required disabled={loading} />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <div className="relative">
            <Input id="confirm-password" type={showConfirm ? "text" : "password"} value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password"
              className={`pr-10 ${mismatch ? "border-destructive focus-visible:ring-destructive" : ""}`}
              required disabled={loading} />
            <button type="button" onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
        </div>

        <Button type="submit" disabled={!canSubmit}
          className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-glow disabled:opacity-50">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Submitting…" : "Submit registration"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button onClick={onSwitch} className="font-medium text-primary hover:underline">
          Sign in
        </button>
      </p>
    </>
  );
}
