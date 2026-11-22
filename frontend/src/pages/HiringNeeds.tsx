import { useSafeNavigate as useNavigate } from "../auth";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../api";
import type { HiringNeeds as HN } from "../types";
import { BillableBadge, Card, Empty, ErrorState, Kpi, Loading, PageHeader, SkillChip, StatusBadge } from "../components/ui";

export default function HiringNeeds() {
  const nav = useNavigate();
  const { data, loading, error, reload } = useApi<HN>("/hiring-needs");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const projectsWithOpen = new Set(data.positions.map((p) => p.project_id)).size;

  return (
    <>
      <PageHeader title="Hiring Needs" subtitle="Open positions on active and pipeline projects, covered first by available internal talent; the rest must be hired." />
      <div className="kpi-grid kpi-4">
        <Kpi label="Open Positions" value={data.total_open} tone="blue" />
        <Kpi label="Projects Hiring" value={projectsWithOpen} tone="violet" />
        <Kpi label="Fillable Internally" value={data.total_open - data.total_to_hire} tone="green" />
        <Kpi label="New Hires Needed" value={data.total_to_hire} tone="red" />
      </div>

      <div className="grid-2">
        <Card title="Demand vs Internal Supply by Skill">
          {data.skills.length === 0 ? (
            <Empty>No open positions.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.skills} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="skill" angle={-35} textAnchor="end" interval={0} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend verticalAlign="top" />
                <Bar dataKey="open" name="Open" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="internal_supply" name="Internal supply" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="to_hire" name="To hire" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Skill Sets to Hire">
          <table className="table compact">
            <thead><tr><th>Skill</th><th>Roles</th><th className="num">Min Exp</th><th className="num">Open</th><th className="num">To Hire</th></tr></thead>
            <tbody>
              {data.skills.map((s) => (
                <tr key={s.skill}>
                  <td><SkillChip name={s.skill} /></td>
                  <td className="muted">{s.roles.join(", ")}</td>
                  <td className="num">{s.min_experience} yrs</td>
                  <td className="num">{s.open}</td>
                  <td className="num">{s.to_hire > 0 ? <strong className="text-red">{s.to_hire}</strong> : <span className="text-green">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Open Positions by Project">
        {data.positions.length === 0 ? (
          <Empty>All requirements are staffed.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Project</th><th>Type</th><th>Status</th><th>Skill</th><th>Role</th><th className="num">Level / Exp</th><th className="num">Open</th><th>Internal Candidates</th><th className="num">Hire</th></tr>
              </thead>
              <tbody>
                {data.positions.map((p) => (
                  <tr key={`${p.project_id}-${p.id}`}>
                    <td className="row-link" onClick={() => nav(`/projects/${p.project_id}`)}>
                      <div className="name">{p.project}</div><div className="sub">{p.code} · {p.client}</div>
                    </td>
                    <td><BillableBadge billable={p.is_billable} /></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><SkillChip name={p.skill} /></td>
                    <td>{p.role}</td>
                    <td className="num">{p.min_proficiency}/5 · {p.min_experience}y</td>
                    <td className="num">{p.open}</td>
                    <td>
                      {p.internal_candidates.length === 0 ? (
                        <span className="muted">None available</span>
                      ) : (
                        p.internal_candidates.map((c) => (
                          <a key={c.employee_id} className="link block" onClick={() => nav(`/resources/${c.employee_id}`)}>
                            {c.full_name} <span className="muted">({c.score.toFixed(0)}%)</span>
                          </a>
                        ))
                      )}
                    </td>
                    <td className="num">{p.to_hire > 0 ? <strong className="text-red">{p.to_hire}</strong> : "—"}</td>
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
