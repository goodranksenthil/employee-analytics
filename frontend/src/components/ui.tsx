import type { ReactNode } from "react";
import type { Status } from "../types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "violet" | "slate";
  onClick?: () => void;
}) {
  return (
    <div className={`kpi ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`kpi-icon tone-${tone}`}>{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div className="card-title">{title}</div>
          {actions}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  Bench: "red",
  "Partially Allocated": "amber",
  "Fully Allocated": "green",
  Active: "green",
  Pipeline: "blue",
  "On Hold": "amber",
  Completed: "slate",
};

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const t = tone ?? (typeof children === "string" ? STATUS_TONE[children] : undefined) ?? "slate";
  return <span className={`badge tone-${t}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: Status | string }) {
  return <Badge>{status}</Badge>;
}

export function BillableBadge({ billable }: { billable: boolean }) {
  return <Badge tone={billable ? "blue" : "violet"}>{billable ? "Billable" : "Non-Billable"}</Badge>;
}

export function SkillChip({ name, level, missing }: { name: string; level?: number; missing?: boolean }) {
  return (
    <span className={`chip ${missing ? "chip-missing" : ""}`}>
      {name}
      {level !== undefined && <span className="chip-level">{level}</span>}
    </span>
  );
}

export function Proficiency({ value }: { value: number }) {
  return (
    <span className="dots" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? "dot on" : "dot"} />
      ))}
    </span>
  );
}

export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const tone = pct === 0 ? "red" : pct < 100 ? "amber" : "green";
  return (
    <div className="meter">
      <div className={`meter-fill tone-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Score({ value }: { value: number }) {
  const tone = value >= 80 ? "green" : value >= 55 ? "amber" : "red";
  return <span className={`score tone-${tone}`}>{value.toFixed(0)}%</span>;
}

export function Loading() {
  return <div className="state">Loading…</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state error">
      <strong>Could not load data.</strong> {message}
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state">{children}</div>;
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} className={`tab ${o.value === value ? "active" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="tab-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
