import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Banknote, Wallet, FileBarChart,
  UserCheck, ShieldCheck, ScrollText, Settings,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useRole } from "@/lib/role-context";
import { hasPermission, type Permission } from "@/lib/permissions";

const MAIN_NAV: { title: string; url: string; icon: React.ElementType; permission: Permission | null }[] = [
  { title: "Dashboard",  url: "/",         icon: LayoutDashboard, permission: null },
  { title: "Clients",    url: "/clients",  icon: Users,           permission: "clients:read" },
  { title: "Loans",      url: "/loans",    icon: Banknote,        permission: "loans:read" },
  { title: "Payments",   url: "/payments", icon: Wallet,          permission: "payments:read" },
  { title: "Reports",    url: "/reports",  icon: FileBarChart,    permission: "reports:read" },
];

const ADMIN_NAV: { title: string; url: string; icon: React.ElementType; permission: Permission }[] = [
  { title: "Collectors",      url: "/collectors", icon: UserCheck,   permission: "collectors:read" },
  { title: "User Management", url: "/users",      icon: ShieldCheck, permission: "users:read" },
  { title: "Audit Logs",      url: "/audit",      icon: ScrollText,  permission: "audit:read" },
  { title: "Settings",        url: "/settings",   icon: Settings,    permission: "settings:read" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { role } = useRole();
  const isActive = (u: string) => (u === "/" ? path === "/" : path.startsWith(u));

  const visibleMain  = MAIN_NAV.filter((i) => i.permission === null || hasPermission(role, i.permission));
  const visibleAdmin = ADMIN_NAV.filter((i) => hasPermission(role, i.permission));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 px-2 py-1">
        <Link to="/" className="flex flex-col items-center justify-center">
          {collapsed ? (
            <img src="/logo.png" alt="BuenaMano" className="h-10 w-10 object-contain mix-blend-screen" />
          ) : (
            <img src="/logo.png" alt="BuenaMano Lending Corporation" className="w-36 h-auto object-contain mix-blend-screen" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {visibleMain.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMain.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
