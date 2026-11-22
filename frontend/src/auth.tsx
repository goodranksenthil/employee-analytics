import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuthToken, setUnauthorizedHandler } from "./api";

export type Permission =
  | "self:view" | "dashboard:view" | "projects:view" | "projects:manage" | "pipeline:view"
  | "resources:view" | "bench:view" | "matching:use" | "hiring:view"
  | "billing:view" | "billing:edit" | "money:view";

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: "employee" | "delivery_manager" | "finance" | "hr";
  role_label: string;
  employee_id: number | null;
  home: string;
  permissions: Permission[];
}

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  can: (p: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "ea.session";

// Session survives a page refresh in this browser only; the server re-checks the token on every call.
function readSession(): { token: string; user: AuthUser } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSession(s: { token: string; user: AuthUser } | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    writeSession(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    const saved = readSession();
    if (!saved) {
      setReady(true);
      return;
    }
    setAuthToken(saved.token);
    // Confirm the saved token is still valid (and pick up role changes).
    api<AuthUser>("/auth/me")
      .then((u) => {
        setUser(u);
        writeSession({ token: saved.token, user: u });
      })
      .catch(() => logout())
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    writeSession(res);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, logout, can: (p) => Boolean(user?.permissions.includes(p)) }),
    [user, ready, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const PATH_PERMS: [string, Permission][] = [
  ["/projects", "projects:view"], ["/pipeline", "pipeline:view"], ["/resources", "resources:view"],
  ["/bench", "bench:view"], ["/matching", "matching:use"], ["/hiring", "hiring:view"], ["/billing", "billing:view"],
];

/** Whether the signed-in role may open an in-app path (used to switch off links to pages it can't see). */
export function useCanOpen() {
  const { can } = useAuth();
  return (path: string) => {
    const hit = PATH_PERMS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
    return !hit || can(hit[1]);
  };
}

/** Like useNavigate, but ignores links to pages the signed-in role can't open. */
export function useSafeNavigate() {
  const navigate = useNavigate();
  const canOpen = useCanOpen();
  return (to: string) => {
    if (canOpen(to)) navigate(to);
  };
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
