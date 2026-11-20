import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, useApi, usd } from "../api";
import type { ProjectDetail as PD } from "../types";
import { BillableBadge, Card, ErrorState, Kpi, Loading, PageHeader, Score, SkillChip, StatusBadge } from "../components/ui";

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useApi<PD>(`/projects/${id}`);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const assign = async (employeeId: number, pct: number) => {
    setMsg(null);
    try {
      const r = await api<{ bill_rate: number }>("/allocations", {
        method: "POST",
        body: JSON.stringify({ employee_id: employeeId, project_id: data.id, allocation_pct: pct }),
      });
      setMsg(`Assigned at ${usd(r.bill_rate)}/hr.`);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const release = async (allocationId: number) => {
    if (!confirm("Release this resource from the project? They will move to the bench if not allocated elsewhere.")) return;
    await api(`/allocations/${allocationId}`, { method: "DELETE" });
    reload();
  };

  return (
    <>
      <Link to="/projects" className="back"><ArrowLeft size={16} /> Projects</Link>
      <PageHeader
        title={data.name}
        subtitle={`${data.code} · ${data.client}`}
        actions={<><BillableBadge billable={data.is_billable} /><StatusBadge status={data.status} /></>}
      />
      <p className="lead">{data.description}</p>

      <div className="kpi-grid kpi-4">
        <Kpi label="Team Size" value={data.team_size} hint={`${data.required_headcount} required`} />
        <Kpi label="Open Positions" value={data.open_positions} tone={data.open_positions ? "red" : "green"} />
        <Kpi label="Monthly Billing" value={usd(data.monthly_revenue)} tone="green" />
        <Kpi label="Timeline" value={data.start_date} hint={data.end_date ? `Ends ${data.end_date}` : "Ongoing"} tone="slate" />
      </div>

      <div className="grid-2">
        <Card title="Requirements">
          <table className="table compact">
            <thead>
              <tr><th>Skill</th><th>Role</th><th className="num">Min Level</th><th className="num">Min Exp</th><th className="num">Filled</th></tr>
            </thead>
            <tbody>
              {data.requirements.map((r) => (
                <tr key={r.id}>
                  <td><SkillChip name={r.skill} /></td>
                  <td>{r.role}</td>
                  <td className="num">{r.min_proficiency}/5</td>
                  <td className="num">{r.min_experience} yrs</td>
                  <td className="num">
                    <span className={r.open ? "text-red" : "text-green"}>{r.filled}/{r.headcount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Assigned Team">
          {data.team.length === 0 ? (
            <p className="muted">No one is assigned yet.</p>
          ) : (
            <table className="table compact">
              <thead>
                <tr><th>Employee</th><th className="num">Alloc.</th><th className="num">Rate</th><th className="num">Monthly</th><th /></tr>
              </thead>
              <tbody>
                {data.team.map((t) => (
                  <tr key={t.allocation_id}>
                    <td className="row-link" onClick={() => nav(`/resources/${t.employee_id}`)}>
                      <div className="name">{t.full_name}</div>
                      <div className="sub">{t.role} · {t.years_experience} yrs</div>
                    </td>
                    <td className="num">{t.allocation_pct}%</td>
                    <td className="num">{t.bill_rate ? `${usd(t.bill_rate)}/hr` : "—"}</td>
                    <td className="num">{t.monthly_billing ? usd(t.monthly_billing) : "—"}</td>
                    <td className="num"><button className="btn btn-ghost btn-sm" onClick={() => release(t.allocation_id)}>Release</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Recommended Candidates" actions={msg && <span className="muted">{msg}</span>}>
        {data.candidates.length === 0 ? (
          <p className="muted">No available employees match the open requirements — see Hiring Needs.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Status</th><th className="num">Available</th><th>Matched Skills</th><th>Missing</th><th className="num">Fit</th><th /></tr>
            </thead>
            <tbody>
              {data.candidates.map((c) => (
                <tr key={c.employee_id}>
                  <td className="row-link" onClick={() => nav(`/resources/${c.employee_id}`)}>
                    <div className="name">{c.full_name}</div>
                    <div className="sub">{c.role} · {c.years_experience} yrs</div>
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="num">{c.available_pct}%</td>
                  <td><div className="chips">{c.matched.map((m) => <SkillChip key={m.skill} name={m.skill} level={m.proficiency} />)}</div></td>
                  <td><div className="chips">{c.missing.map((m) => <SkillChip key={m} name={m} missing />)}</div></td>
                  <td className="num"><Score value={c.score} /></td>
                  <td className="num">
                    <button className="btn btn-primary btn-sm" onClick={() => assign(c.employee_id, Math.min(c.available_pct, 100))}>
                      Assign {c.available_pct}%
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
