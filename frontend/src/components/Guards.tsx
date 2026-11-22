import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth, type Permission } from "../auth";
import { Loading } from "./ui";

/** Sends signed-out visitors to /login, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

/** Shows an access-denied page when the signed-in role lacks every one of `perms`. */
export function RequirePerm({ perms, children }: { perms: Permission[]; children: ReactNode }) {
  const { user, can } = useAuth();
  if (perms.some(can)) return <>{children}</>;
  return (
    <div className="denied card">
      <ShieldAlert size={36} />
      <h2>No access</h2>
      <p className="muted">
        Your role (<strong>{user?.role_label}</strong>) can't open this page.
      </p>
      <Link className="btn btn-primary" to={user?.home ?? "/"}>Go to my home page</Link>
    </div>
  );
}
