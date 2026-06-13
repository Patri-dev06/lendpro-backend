import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { SessionTimeoutDialog } from "@/components/layout/SessionTimeoutDialog";
import { useSessionTimeout } from "@/lib/use-session-timeout";
import { useRole } from "@/lib/role-context";
import { apiRequest } from "@/lib/api";

const DEFAULT_TIMEOUT_MIN = 30;
const WARN_BEFORE_MIN     = 2;

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    // Client-side only: localStorage not available on the server
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("bm_token");
    if (!token) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { logout, token, isLoading, isAuthenticated } = useRole();
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MIN * 60 * 1000);

  // Client-side auth guard — covers the SSR case where beforeLoad cannot
  // check localStorage. Redirects to login once RoleProvider finishes its
  // initial auth/me check and confirms the user is not authenticated.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Fetch the admin-configured session timeout once the token is available
  useEffect(() => {
    if (!token) return;
    apiRequest<{ key: string; value: string }[]>("GET", "settings", { token })
      .then((settings) => {
        const row = settings.find((s) => s.key === "session_timeout_minutes");
        const mins = row ? parseInt(row.value, 10) : DEFAULT_TIMEOUT_MIN;
        if (mins > 0) setTimeoutMs(mins * 60 * 1000);
      })
      .catch(() => {});
  }, [token]);

  async function handleTimeout() {
    await logout();
    navigate({ to: "/login" });
  }

  const { showWarning, secondsLeft, extend } = useSessionTimeout({
    timeoutMs,
    warnBeforeMs: WARN_BEFORE_MIN * 60 * 1000,
    onTimeout: handleTimeout,
  });

  // Show a spinner while RoleProvider is verifying the stored token.
  // This prevents an unauthenticated user from seeing the dashboard
  // for the brief moment before the redirect fires.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Auth check finished but user is not authenticated — render nothing
  // while the useEffect above triggers the navigation to /login.
  if (!isAuthenticated) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>

      <SessionTimeoutDialog
        open={showWarning}
        secondsLeft={secondsLeft}
        onExtend={extend}
        onLogout={handleTimeout}
      />
    </SidebarProvider>
  );
}
