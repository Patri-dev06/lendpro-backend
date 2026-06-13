import { createFileRoute } from "@tanstack/react-router";
import { useRole } from "@/lib/role-context";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { CollectorDashboard } from "@/components/dashboard/CollectorDashboard";
import { ManagerDashboard } from "@/components/dashboard/ManagerDashboard";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Dashboard — BuenaMano" }] }),
  component: DashboardSwitch,
});

function DashboardSwitch() {
  const { role } = useRole();
  if (role === "collector") return <CollectorDashboard />;
  if (role === "manager" || role === "sysadmin" || role === "accounting_clerk") return <ManagerDashboard />;
  return <AdminDashboard />;
}
