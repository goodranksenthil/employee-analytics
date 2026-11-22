import { useState } from "react";
import { Ban, CheckCircle2, Inbox, Star, UserCheck } from "lucide-react";
import { api, useApi } from "../api";
import { useSafeNavigate } from "../auth";
import type { ApplicationRow, ApplicationStatus } from "../types";
import { Card, Empty, ErrorState, Kpi, Loading, PageHeader, Score, SkillChip, StatusBadge, Tabs } from "../components/ui";

type Filter = "all" | ApplicationStatus;

const ACTIONS: { status: ApplicationStatus; label: string; className: string }[] = [
  { status: "Shortlisted", label: "Shortlist", className: "btn-ghost" },
  { status: "Selected", label: "Select", className: "btn-primary" },
  { status: "Rejected", label: "Reject", className: "btn-ghost btn-danger" },
];

export default function Applications() {
  const nav = useSafeNavigate();
  const { data, loading, error, reload } = useApi<{ applications: ApplicationRow[]; counts: Record<string, number> }>("/applications");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const c = (s: ApplicationStatus) => data.counts[s] ?? 0;
  const rows = filter === "all" ? data.applications : data.applications.filter((a) => a.status === filter);

  const setStatus = async (a: ApplicationRow, status: ApplicationStatus) => {
    setBusy(a.id);
    setMsg(null);
    try {
      await api(`/applications/${a.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMsg(`${a.employee.full_name} → ${status} for ${a.position.skill} · ${a.position.project}.`);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Applications" subtitle="Employees who applied for open positions. Shortlist, select or reject each application." />

      <div className="kpi-grid kpi-4">
        <Kpi label="New" value={c("Applied")} hint="Waiting for review" icon={<Inbox size={18} />} tone="blue" onClick={() => setFilter("Applied")} />
        <Kpi label="Shortlisted" value={c("Shortlisted")} icon={<Star size={18} />} tone="amber" onClick={() => setFilter("Shortlisted")} />
        <Kpi label="Selected" value={c("Selected")} hint="Assign them from the project page" icon={<UserCheck size={18} />} tone="green" onClick={() => setFilter("Selected")} />
        <Kpi label="Rejected" value={c("Rejected")} icon={<Ban size={18} />} tone="red" onClick={() => setFilter("Rejected")} />
      </div>

      <Card
        title={
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: data.applications.length },
              { value: "Applied", label: "New", count: c("Applied") },
              { value: "Shortlisted", label: "Shortlisted", count: c("Shortlisted") },
              { value: "Selected", label: "Selected", count: c("Selected") },
              { value: "Rejected", label: "Rejected", count: c("Rejected") },
            ]}
          />
        }
        actions={msg && <span className="muted"><CheckCircle2 size={14} style={{ verticalAlign: "-2px" }} /> {msg}</span>}
      >
        {rows.length === 0 ? (
          <Empty>{data.applications.length === 0 ? "No applications yet. Employees apply from their Open Positions page." : "No applications with this status."}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th><th>Position</th><th>Fit</th><th className="num">Available</th>
                  <th>Note</th><th>Applied</th><th>Status</th><th className="num">Decision</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="row-link" onClick={() => nav(`/resources/${a.employee.id}`)}>
                      <div className="name">{a.employee.full_name}</div>
                      <div className="sub">{a.employee.role} · {a.employee.years_experience} yrs</div>
                    </td>
                    <td className="row-link" onClick={() => nav(`/projects/${a.position.project_id}`)}>
                      <div className="chips"><SkillChip name={a.position.skill} /> <span>{a.position.role}</span></div>
                      <div className="sub">{a.position.project} · {a.position.client}</div>
                    </td>
                    <td>
                      <Score value={a.fit.score} />
                      <div className="sub">{a.fit.level ? `Level ${a.fit.level}/5 (needs ${a.position.min_proficiency})` : "No experience in skill"}</div>
                    </td>
                    <td className="num">{a.employee.available_pct}%</td>
                    <td className="note-cell">{a.note || <span className="muted">—</span>}</td>
                    <td className="muted">{a.applied_at.slice(0, 10)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                      {a.reviewed_by && <div className="sub">by {a.reviewed_by}</div>}
                    </td>
                    <td className="num">
                      <div className="decision">
                        {ACTIONS.filter((x) => x.status !== a.status).map((x) => (
                          <button key={x.status} className={`btn btn-sm ${x.className}`} disabled={busy === a.id} onClick={() => setStatus(a, x.status)}>
                            {x.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
