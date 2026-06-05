import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    if (typeof window === "undefined") throw redirect({ to: "/login" });
    const token = localStorage.getItem("bm_token");
    if (!token) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { logout, token } = useRole();
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MIN * 60 * 1000);

  // Fetch the admin-configured timeout once the token is available
  useEffect(() => {
    if (!token) return;
    apiRequest<{ key: string; value: string }[]>("GET", "settings", { token })
      .then((settings) => {
        const row = settings.find((s) => s.key === "session_timeout_minutes");
        const mins = row ? parseInt(row.value, 10) : DEFAULT_TIMEOUT_MIN;
        if (mins > 0) setTimeoutMs(mins * 60 * 1000);
      })
      .catch(() => {}); // keep default on failure
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
