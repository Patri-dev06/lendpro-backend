import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, Banknote, CircleDollarSign, UserPlus, UserCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

function typeIcon(type: string) {
  switch (type) {
    case "loan_created":    return <Banknote className="h-3.5 w-3.5" />;
    case "payment_recorded": return <CircleDollarSign className="h-3.5 w-3.5" />;
    case "user_pending":    return <UserPlus className="h-3.5 w-3.5" />;
    case "user_approved":   return <UserCheck className="h-3.5 w-3.5" />;
    default:                return <Bell className="h-3.5 w-3.5" />;
  }
}

function typeColor(type: string): string {
  switch (type) {
    case "loan_created":     return "bg-emerald-100 text-emerald-700";
    case "payment_recorded": return "bg-blue-100 text-blue-700";
    case "user_pending":     return "bg-amber-100 text-amber-700";
    case "user_approved":    return "bg-emerald-100 text-emerald-700";
    default:                 return "bg-primary/10 text-primary";
  }
}

function relativeTime(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const { token } = useRole();
  const [open, setOpen]   = useState(false);
  const [items, setItems]  = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ notifications: Notification[]; unread_count: number }>(
        "GET",
        "notifications",
        { token }
      );
      setItems(data.notifications);
      setUnread(data.unread_count);
    } catch {
      // silently ignore polling failures
    }
  }, [token]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  async function handleMarkRead() {
    if (!token || unread === 0) return;
    setLoading(true);
    try {
      await apiRequest("POST", "notifications/mark-read", { token });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) load();
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <p className="text-xs text-muted-foreground">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-primary"
              onClick={handleMarkRead}
              disabled={loading}
            >
              <Check className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="h-90">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 transition-colors ${n.is_read ? "" : "bg-primary/3"}`}
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${typeColor(n.type)}`}>
                    {typeIcon(n.type)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{relativeTime(n.created_at)}</p>
                  </div>

                  {!n.is_read && (
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {items.length > 0 && (
          <div className="border-t px-4 py-2.5 text-center">
            <p className="text-xs text-muted-foreground">Showing last {items.length} notifications</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
