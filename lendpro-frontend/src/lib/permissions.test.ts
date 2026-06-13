import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PERMISSIONS } from "./permissions";
import type { Permission } from "./permissions";

describe("hasPermission", () => {
  describe("admin", () => {
    it("has all permissions", () => {
      const allPermissions: Permission[] = [
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
      allPermissions.forEach((p) => {
        expect(hasPermission("admin", p)).toBe(true);
      });
    });
  });

  describe("manager", () => {
    it("can read clients, loans, schedule, payments, reports, collectors, audit", () => {
      expect(hasPermission("manager", "clients:read")).toBe(true);
      expect(hasPermission("manager", "loans:read")).toBe(true);
      expect(hasPermission("manager", "schedule:read")).toBe(true);
      expect(hasPermission("manager", "payments:read")).toBe(true);
      expect(hasPermission("manager", "reports:read")).toBe(true);
      expect(hasPermission("manager", "collectors:read")).toBe(true);
      expect(hasPermission("manager", "audit:read")).toBe(true);
    });

    it("cannot write clients, loans, or payments", () => {
      expect(hasPermission("manager", "clients:write")).toBe(false);
      expect(hasPermission("manager", "loans:write")).toBe(false);
      expect(hasPermission("manager", "payments:write")).toBe(false);
    });

    it("cannot access user management or settings", () => {
      expect(hasPermission("manager", "users:read")).toBe(false);
      expect(hasPermission("manager", "settings:read")).toBe(false);
    });
  });

  describe("accounting_clerk", () => {
    it("can read and write payments", () => {
      expect(hasPermission("accounting_clerk", "payments:read")).toBe(true);
      expect(hasPermission("accounting_clerk", "payments:write")).toBe(true);
    });

    it("can read clients, schedule, reports, collectors", () => {
      expect(hasPermission("accounting_clerk", "clients:read")).toBe(true);
      expect(hasPermission("accounting_clerk", "schedule:read")).toBe(true);
      expect(hasPermission("accounting_clerk", "reports:read")).toBe(true);
      expect(hasPermission("accounting_clerk", "collectors:read")).toBe(true);
    });

    it("cannot access loans, users, audit, or settings", () => {
      expect(hasPermission("accounting_clerk", "loans:read")).toBe(false);
      expect(hasPermission("accounting_clerk", "users:read")).toBe(false);
      expect(hasPermission("accounting_clerk", "audit:read")).toBe(false);
      expect(hasPermission("accounting_clerk", "settings:read")).toBe(false);
    });
  });

  describe("collector", () => {
    it("can read clients, schedule, and payments", () => {
      expect(hasPermission("collector", "clients:read")).toBe(true);
      expect(hasPermission("collector", "schedule:read")).toBe(true);
      expect(hasPermission("collector", "payments:read")).toBe(true);
    });

    it("can write payments", () => {
      expect(hasPermission("collector", "payments:write")).toBe(true);
    });

    it("cannot access loans, reports, collectors, users, or settings", () => {
      expect(hasPermission("collector", "loans:read")).toBe(false);
      expect(hasPermission("collector", "reports:read")).toBe(false);
      expect(hasPermission("collector", "collectors:read")).toBe(false);
      expect(hasPermission("collector", "users:read")).toBe(false);
      expect(hasPermission("collector", "settings:read")).toBe(false);
    });
  });

  describe("sysadmin", () => {
    it("can manage users and settings", () => {
      expect(hasPermission("sysadmin", "users:read")).toBe(true);
      expect(hasPermission("sysadmin", "users:write")).toBe(true);
      expect(hasPermission("sysadmin", "settings:read")).toBe(true);
      expect(hasPermission("sysadmin", "settings:write")).toBe(true);
      expect(hasPermission("sysadmin", "audit:read")).toBe(true);
    });

    it("cannot access business operations", () => {
      expect(hasPermission("sysadmin", "clients:read")).toBe(false);
      expect(hasPermission("sysadmin", "loans:read")).toBe(false);
      expect(hasPermission("sysadmin", "payments:read")).toBe(false);
      expect(hasPermission("sysadmin", "reports:read")).toBe(false);
    });
  });
});

describe("ROLE_PERMISSIONS", () => {
  it("defines permissions for all 5 roles", () => {
    const roles = ["admin", "manager", "accounting_clerk", "collector", "sysadmin"];
    roles.forEach((role) => {
      expect(ROLE_PERMISSIONS).toHaveProperty(role);
    });
  });

  it("admin has more permissions than manager", () => {
    expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(ROLE_PERMISSIONS.manager.length);
  });

  it("collector has the fewest permissions", () => {
    const lengths = Object.values(ROLE_PERMISSIONS).map((p) => p.length);
    expect(ROLE_PERMISSIONS.collector.length).toBe(Math.min(...lengths));
  });
});
