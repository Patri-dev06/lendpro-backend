import type { Role } from "@/lib/role-context";

export type Permission =
  | "clients:read"    | "clients:write"
  | "loans:read"      | "loans:write"
  | "schedule:read"
  | "payments:read"   | "payments:write"
  | "reports:read"
  | "collectors:read" | "collectors:write"
  | "users:read"      | "users:write"
  | "audit:read"
  | "settings:read"   | "settings:write";

const ALL: Permission[] = [
  "clients:read", "clients:write",
  "loans:read", "loans:write",
  "schedule:read",
  "payments:read", "payments:write",
  "reports:read",
  "collectors:read", "collectors:write",
  "users:read", "users:write",
  "audit:read",
  "settings:read", "settings:write",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,

  manager: [
    "clients:read", "clients:write",
    "loans:read",   "loans:write",
    "schedule:read",
    "payments:read",
    "reports:read",
    "collectors:read", "collectors:write",
    "audit:read",
  ],

  accounting_clerk: [
    "clients:read",
    "loans:read",
    "schedule:read",
    "payments:read", "payments:write",
    "reports:read",
    "collectors:read",
  ],

  collector: [
    "clients:read",
    "schedule:read",
    "payments:read", "payments:write",
  ],

  sysadmin: [
    "users:read", "users:write",
    "audit:read",
    "settings:read", "settings:write",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
