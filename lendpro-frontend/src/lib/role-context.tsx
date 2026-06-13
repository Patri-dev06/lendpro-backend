import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/api";

export type Role = "admin" | "collector" | "manager" | "sysadmin" | "accounting_clerk";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  collector: "Collector",
  manager: "Manager",
  sysadmin: "System Administrator",
  accounting_clerk: "Accounting Clerk",
};

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

interface RoleContextValue {
  user: AuthUser | null;
  token: string | null;
  role: Role;
  isAuthenticated: boolean;
  isLoading: boolean;
  setRole: (r: Role) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, role: Role, password: string, passwordConfirmation: string) => Promise<void>;
}

const TOKEN_KEY = "bm_token";

const RoleCtx = createContext<RoleContextValue>({
  user: null,
  token: null,
  role: "admin",
  isAuthenticated: false,
  isLoading: false,
  setRole: () => {},
  login: async () => {},
  logout: async () => {},
  register: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [token, setToken]   = useState<string | null>(null);
  const [role, setRoleState] = useState<Role>("admin");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setIsLoading(false); return; }
    apiRequest<AuthUser>("GET", "auth/me", { token: stored })
      .then((u) => { setUser(u); setRoleState(u.role); setToken(stored); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { user: u, token: t } = await apiRequest<AuthResponse>("POST", "auth/login", {
      body: { email, password },
    });
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    setRoleState(u.role);
  }

  async function logout() {
    if (token) {
      await apiRequest("POST", "auth/logout", { token }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setRoleState("admin");
  }

  async function register(
    name: string,
    email: string,
    roleArg: Role,
    password: string,
    passwordConfirmation: string,
  ) {
    await apiRequest<{ message: string; pending: boolean }>("POST", "auth/register", {
      body: { name, email, role: roleArg, password, password_confirmation: passwordConfirmation },
    });
  }

  return (
    <RoleCtx.Provider
      value={{ user, token, role, isAuthenticated: !!user, isLoading, setRole: setRoleState, login, logout, register }}
    >
      {children}
    </RoleCtx.Provider>
  );
}

export const useRole = () => useContext(RoleCtx);
