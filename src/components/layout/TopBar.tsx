import { useState } from "react";
import { Search, ChevronDown, LogOut, Settings, KeyRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, useRole } from "@/lib/role-context";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ChangePasswordDialog } from "@/components/layout/ChangePasswordDialog";
import { formatDate } from "@/lib/format";

export function TopBar() {
  const navigate = useNavigate();
  const { role, user, logout } = useRole();
  const [changePwOpen, setChangePwOpen] = useState(false);
  const displayName = user?.name ?? "User";
  const initials = displayName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 md:px-4">

      <SidebarTrigger className="-ml-1 h-8 w-8 shrink-0" />
      <Separator orientation="vertical" className="h-5 shrink-0" />

      <div className="flex items-center gap-2 lg:hidden">
        <img src="/logo.png" alt="" className="h-7 w-7 object-contain mix-blend-multiply" />
        <span className="font-display text-sm font-bold">
          <span className="text-amber-500">Buena</span><span className="text-blue-700">Mano</span>
        </span>
      </div>

      <div className="relative mx-2 hidden flex-1 max-w-sm md:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients, loans, payments…"
          className="h-8 rounded-lg pl-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:block mr-2">
          {formatDate(new Date(), { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
        </span>

        <NotificationBell />

        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight md:block">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{ROLE_LABELS[role]}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal pb-2">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setChangePwOpen(true)} className="cursor-pointer">
              <KeyRound className="mr-2 h-4 w-4" />Change Password
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </header>
  );
}
