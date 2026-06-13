import { Lock } from "lucide-react";

export function AccessRestricted() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-20 text-center shadow-sm">
      <div className="rounded-full bg-muted p-5">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold">Access Restricted</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        This section is only available to the <span className="font-medium text-foreground">Accounting Clerk</span>. Switch your role to access it.
      </p>
    </div>
  );
}
