import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BadgeDollarSign, Briefcase, KeyRound, LogIn, UserRound, Users, UsersRound } from "lucide-react";
import { useAuth } from "../auth";

// Demo accounts (created by the seed). Shown here so reviewers can try each role.
const DEMO = [
  {
    username: "employee", password: "Employee@123", label: "Employee", icon: UserRound, tone: "slate",
    sees: "My profile (skills, assignments) and open positions: view tech stack and apply",
  },
  {
    username: "delivery", password: "Delivery@123", label: "Delivery Manager", icon: Briefcase, tone: "blue",
    sees: "Dashboard, projects, pipeline, resources, bench, allocation, matching, hiring, applications",
  },
  {
    username: "finance", password: "Finance@123", label: "Finance", icon: BadgeDollarSign, tone: "green",
    sees: "Dashboard, projects, pipeline value, billing & rate card",
  },
  {
    username: "hr", password: "Hr@12345", label: "HR", icon: UsersRound, tone: "violet",
    sees: "Dashboard, employees & skills, bench, matching, hiring, applications (no billing figures)",
  },
] as const;

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (loc.state as { from?: string } | null)?.from;
  if (user) return <Navigate to={from ?? user.home} replace />;

  const signIn = async (u: string, p: string) => {
    setBusy(true);
    setError(null);
    try {
      const me = await login(u, p);
      nav(from && from !== "/login" ? from : me.home, { replace: true });
    } catch (e) {
      setError((e as Error).message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) return setError("Enter your username and password");
    void signIn(username, password);
  };

  return (
    <div className="login-shell">
      <aside className="login-brand">
        <div className="brand">
          <div className="brand-mark"><Briefcase size={18} /></div>
          <div>
            <div className="brand-name">Resource Hub</div>
            <div className="brand-sub">Workforce Analytics</div>
          </div>
        </div>
        <div className="login-hero">
          <h1>Projects, people and billing in one place.</h1>
          <p>Each role signs in to its own view: delivery managers staff projects, finance tracks billing, HR manages talent, and employees see their own profile.</p>
          <ul>
            <li><Users size={16} /> 62 employees · 17 projects</li>
            <li><BadgeDollarSign size={16} /> Bill rates by role, experience & skills</li>
            <li><KeyRound size={16} /> Role-based access enforced by the API</li>
          </ul>
        </div>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <h2>Sign in</h2>
          <p className="muted">Use your credentials, or pick a demo account below.</p>

          <form onSubmit={submit} className="login-form">
            <label className="field">
              <span>Username</span>
              <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. delivery" />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <div className="login-error">{error}</div>}
            <button className="btn btn-primary login-submit" disabled={busy}>
              <LogIn size={16} /> {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="demo-head">
            <span>Demo credentials</span>
            <span className="muted small">Click a card to sign in as that role</span>
          </div>
          <div className="demo-grid">
            {DEMO.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.username}
                  type="button"
                  className="demo-card"
                  disabled={busy}
                  onClick={() => {
                    setUsername(d.username);
                    setPassword(d.password);
                    void signIn(d.username, d.password);
                  }}
                >
                  <div className="demo-top">
                    <span className={`kpi-icon tone-${d.tone}`}><Icon size={16} /></span>
                    <strong>{d.label}</strong>
                  </div>
                  <div className="demo-cred">
                    <span>Username</span><code>{d.username}</code>
                    <span>Password</span><code>{d.password}</code>
                  </div>
                  <div className="demo-sees">{d.sees}</div>
                </button>
              );
            })}
          </div>
          <p className="muted small demo-note">Demo accounts with sample data only. Change these passwords before loading real data.</p>
        </div>
      </main>
    </div>
  );
}
