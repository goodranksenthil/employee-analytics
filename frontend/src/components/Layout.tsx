import { useState, type ElementType } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  Bell,
  CalendarClock,
  Briefcase,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  LayoutDashboard,
  Armchair,
  Search,
  Sparkles,
  UserPlus,
  Users,
  CircleDollarSign,
  CircleOff,
  LogOut,
  UserRound,
  BriefcaseBusiness,
  Inbox,
} from "lucide-react";
import { useAuth, type Permission } from "../auth";

type NavItem = { to: string; label: string; icon: ElementType; end?: boolean; perm: Permission };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, perm: "dashboard:view" },
      { to: "/me", label: "My Profile", icon: UserRound, perm: "self:view" },
      { to: "/positions", label: "Open Positions", icon: BriefcaseBusiness, perm: "positions:view" },
    ],
  },
  {
    section: "Projects",
    items: [
      { to: "/projects", label: "All Projects", icon: FolderKanban, end: true, perm: "projects:view" },
      { to: "/projects?billable=true", label: "Billable", icon: CircleDollarSign, perm: "projects:view" },
      { to: "/pipeline", label: "Pipeline", icon: CalendarClock, perm: "pipeline:view" },
      { to: "/projects?billable=false", label: "Non-Billable", icon: CircleOff, perm: "projects:view" },
    ],
  },
  {
    section: "Resources",
    items: [
      { to: "/resources", label: "Resources", icon: Users, perm: "resources:view" },
      { to: "/bench", label: "Bench", icon: Armchair, perm: "bench:view" },
    ],
  },
  {
    section: "Talent",
    items: [
      { to: "/matching", label: "Skill Matching", icon: Sparkles, perm: "matching:use" },
      { to: "/hiring", label: "Hiring Needs", icon: UserPlus, perm: "hiring:view" },
      { to: "/applications", label: "Applications", icon: Inbox, perm: "applications:review" },
    ],
  },
  { section: "Finance", items: [{ to: "/billing", label: "Billing & Rates", icon: BadgeDollarSign, perm: "billing:view" }] },
];

const ROLE_TONE: Record<string, string> = {
  employee: "slate",
  delivery_manager: "blue",
  finance: "green",
  hr: "violet",
};

const TITLES: Record<string, string> = {
  "": "Dashboard",
  me: "My Profile",
  positions: "Open Positions",
  applications: "Applications",
  projects: "Projects",
  pipeline: "Pipeline",
  resources: "Resources",
  bench: "Bench",
  matching: "Skill Matching",
  hiring: "Hiring Needs",
  billing: "Billing & Rates",
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const loc = useLocation();
  const navigate = useNavigate();
  const parts = loc.pathname.split("/").filter(Boolean);
  const section = TITLES[parts[0] ?? ""] ?? "Dashboard";
  const { user, can, logout } = useAuth();
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length);
  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Query-string nav items (billable filters) need a custom active check.
  const isActive = (item: NavItem) => {
    const [path, query] = item.to.split("?");
    if (query) return loc.pathname === path && loc.search === `?${query}`;
    if (item.end) return loc.pathname === path && (path !== "/projects" || !loc.search);
    return loc.pathname.startsWith(path);
  };

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Briefcase size={18} />
          </div>
          {!collapsed && (
            <div>
              <div className="brand-name">Resource Hub</div>
              <div className="brand-sub">Workforce Analytics</div>
            </div>
          )}
        </div>
        <nav>
          {nav.map((group) => (
            <div key={group.section} className="nav-group">
              {!collapsed && <div className="nav-section">{group.section}</div>}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={() => `nav-item ${isActive(item) ? "active" : ""}`}
                  >
                    <Icon size={18} />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs">
            <span className="crumb-root">Home</span>
            <span className="crumb-sep">/</span>
            <span>{section}</span>
          </div>
          {can("resources:view") ? (
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/resources?search=${encodeURIComponent(q)}`);
              }}
            >
              <Search size={16} />
              <input placeholder="Search employees, skills, roles…" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          ) : (
            <div className="search-spacer" />
          )}
          <div className="topbar-right">
            <button className="icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="user-chip">
              <div className="avatar">{initials}</div>
              <div className="user-meta">
                <div className="user-name">{user?.full_name}</div>
                <span className={`badge tone-${ROLE_TONE[user?.role ?? ""] ?? "slate"}`}>{user?.role_label}</span>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm signout"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
