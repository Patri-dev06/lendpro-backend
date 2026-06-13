import { ShieldOff } from "lucide-react";
import { ROLE_LABELS } from "@/lib/role-context";
import { hasPermission, type Permission } from "@/lib/permissions";
import { useRole } from "@/lib/role-context";
import type { ReactNode } from "react";

interface AccessRestrictedProps {
  /** Roles that ARE allowed — shown in the message */
  allowedRoles?: string[];
}

export function AccessRestricted({ allowedRoles }: AccessRestrictedProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-24 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold">Access Restricted</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        You don't have permission to view this page.
        {allowedRoles && allowedRoles.length > 0 && (
          <>
            {" "}This section is available to:{" "}
            <span className="font-medium text-foreground">
              {allowedRoles.join(", ")}
            </span>
            .
          </>
        )}
      </p>
    </div>
  );
}

/** Renders children only if the current user has the required permission. */
export function PermissionGuard({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { role } = useRole();
  if (!hasPermission(role, permission)) {
    const allowed = Object.entries(ROLE_LABELS)
      .filter(([r]) => hasPermission(r as Parameters<typeof hasPermission>[0], permission))
      .map(([, label]) => label);
    return <AccessRestricted allowedRoles={allowed} />;
  }
  return <>{children}</>;
}
