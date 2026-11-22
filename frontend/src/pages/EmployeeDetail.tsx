import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Calendar } from "lucide-react";
import { useApi, usd } from "../api";
import { useAuth } from "../auth";
import type { EmployeeDetail as ED } from "../types";
import { BillableBadge, Card, ErrorState, Kpi, Loading, Meter, PageHeader, Proficiency, Score, SkillChip, StatusBadge } from "../components/ui";
import { initials } from "./Resources";

/** Resource page (/resources/:id) or, with employeeId, the signed-in employee's own profile (/me). */
export default function EmployeeDetail({ employeeId }: { employeeId?: number }) {
  const params = useParams();
  const id = employeeId ?? params.id;
  const nav = useNavigate();
  const { can } = useAuth();
  const money = can("money:view");
  const canOpenProjects = can("projects:view");
  const isSelf = employeeId !== undefined;
  const { data: e, loading, error, reload } = useApi<ED>(`/employees/${id}`);
  if (loading) return <Loading />;
  if (error || !e) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const byCategory = e.skills_detail.reduce<Record<string, ED["skills_detail"]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  const r = money ? e.rate : undefined;
  const openProject = (pid: number) => canOpenProjects && nav(`/projects/${pid}`);

  return (
    <>
      {isSelf ? (
        <PageHeader title="My Profile" subtitle="Your skills, project assignments and the open projects that fit you best." />
      ) : (
        can("resources:view") && <Link to="/resources" className="back"><ArrowLeft size={16} /> Resources</Link>
      )}

      <div className="profile card">
        <div className="avatar lg">{initials(e.full_name)}</div>
        <div className="profile-main">
          <h1>{e.full_name}</h1>
          <div className="sub">{e.role} · {e.emp_code}</div>
          <div className="profile-meta">
            <span><Mail size={14} /> {e.email}</span>
            <span><MapPin size={14} /> {e.location}</span>
            <span><Calendar size={14} /> Joined {e.join_date}</span>
          </div>
        </div>
        <div className="profile-side">
          <StatusBadge status={e.status} />
          <div style={{ width: 160 }}>
            <Meter value={e.utilization} />
            <div className="sub">{e.utilization}% utilized · {e.available_pct}% free</div>
          </div>
        </div>
      </div>

      <div className="kpi-grid kpi-4">
        <Kpi label="Experience" value={`${e.years_experience} yrs`} tone="slate" />
        <Kpi label="Skills" value={e.skills_detail.length} hint={`${e.skills_detail.filter((s) => s.proficiency >= 4).length} at advanced level`} tone="blue" />
        {r ? (
          <Kpi label="Bill Rate" value={`${usd(r.hourly_rate)}/hr`} hint={`${usd(r.monthly_full_time)} / month full-time`} tone="green" />
        ) : (
          <Kpi label="Utilization" value={`${e.utilization}%`} hint={e.status} tone="amber" />
        )}
        <Kpi label="Active Projects" value={e.projects.length} tone="violet" />
      </div>

      <div className={r ? "grid-2" : ""}>
        <Card title="Skills">
          {Object.entries(byCategory).map(([cat, skills]) => (
            <div key={cat} className="skill-group">
              <div className="skill-cat">{cat}</div>
              {skills.map((s) => (
                <div key={s.skill_id} className="skill-row">
                  <span>{s.name}</span>
                  <span className="muted">{s.years} yrs</span>
                  <Proficiency value={s.proficiency} />
                </div>
              ))}
            </div>
          ))}
        </Card>

        {r && (
          <Card title="Bill Rate Breakdown">
            <ul className="stat-list">
              <li><span>Role base ({r.role})</span><strong>{usd(r.base, 2)}</strong></li>
              <li><span>Experience ({e.years_experience} yrs)</span><strong>+ {usd(r.experience, 2)}</strong></li>
              {r.skill_premiums.map((p) => (
                <li key={p.skill}><span>Skill premium · {p.skill}</span><strong>+ {usd(p.amount, 2)}</strong></li>
              ))}
              <li className="total"><span>Hourly rate {r.capped && <em className="muted">(capped at role max)</em>}</span><strong>{usd(r.hourly_rate)}/hr</strong></li>
            </ul>
            <p className="muted small">Rate = role base + per-year rate × experience (max 20 yrs) + top 3 skill premiums scaled by proficiency.</p>
          </Card>
        )}
      </div>

      <Card title="Project Assignments">
        {e.allocations.length === 0 ? (
          <p className="muted">No project history.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Project</th><th>Client</th><th>Type</th><th className="num">Allocation</th>
                {money && <><th className="num">Bill Rate</th><th className="num">Monthly</th></>}
                <th>Period</th><th>State</th>
              </tr>
            </thead>
            <tbody>
              {e.allocations.map((a) => (
                <tr key={a.id} className={canOpenProjects ? "row-link" : ""} onClick={() => openProject(a.project_id)}>
                  <td><div className="name">{a.name}</div><div className="sub">{a.code}</div></td>
                  <td>{a.client}</td>
                  <td><BillableBadge billable={a.is_billable} /></td>
                  <td className="num">{a.allocation_pct}%</td>
                  {money && (
                    <>
                      <td className="num">{a.bill_rate ? `${usd(a.bill_rate)}/hr` : "—"}</td>
                      <td className="num">{a.monthly_billing ? usd(a.monthly_billing) : "—"}</td>
                    </>
                  )}
                  <td className="muted">{a.start_date} → {a.end_date ?? "present"}</td>
                  <td>{a.active ? <span className="text-green">Active</span> : <span className="muted">Ended</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={isSelf ? "Open Projects That Fit Your Skills" : "Best-Fit Open Projects"}>
        {e.best_fit_projects.length === 0 ? (
          <p className="muted">No open positions match these skills.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Project</th><th>Type</th><th>Matched</th><th>Missing</th><th className="num">Fit</th></tr></thead>
            <tbody>
              {e.best_fit_projects.map((p) => (
                <tr key={p.project_id} className={canOpenProjects ? "row-link" : ""} onClick={() => openProject(p.project_id)}>
                  <td><div className="name">{p.name}</div><div className="sub">{p.code} · {p.status}</div></td>
                  <td><BillableBadge billable={p.is_billable} /></td>
                  <td><div className="chips">{p.matched.map((m) => <SkillChip key={m.skill} name={m.skill} level={m.proficiency} />)}</div></td>
                  <td><div className="chips">{p.missing.map((m) => <SkillChip key={m} name={m} missing />)}</div></td>
                  <td className="num"><Score value={p.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
