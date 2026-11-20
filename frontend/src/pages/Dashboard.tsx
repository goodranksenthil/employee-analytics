import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Armchair, BadgeDollarSign, FolderKanban, Gauge, UserPlus, Users } from "lucide-react";
import { compactUsd, useApi, usd } from "../api";
import type { DashboardSummary } from "../types";
import { Card, ErrorState, Kpi, Loading, PageHeader, SkillChip } from "../components/ui";

const C = { blue: "#2563eb", violet: "#7c3aed", green: "#16a34a", amber: "#d97706", red: "#dc2626", slate: "#94a3b8" };

export default function Dashboard() {
  const { data, loading, error, reload } = useApi<DashboardSummary>("/dashboard/summary");
  const nav = useNavigate();
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;
  const { projects: p, resources: r, billing: b } = data;

  const projectMix = [
    { name: "Billable", value: p.billable, color: C.blue },
    { name: "Non-Billable", value: p.non_billable, color: C.violet },
  ];
  const resourceMix = [
    { name: "Fully Allocated", value: r.fully_allocated, color: C.green },
    { name: "Partial", value: r.partial, color: C.amber },
    { name: "Bench", value: r.bench, color: C.red },
  ];
  const roles = Object.entries(r.by_role)
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader title="Resource Dashboard" subtitle="Organization-wide view of projects, people, bench and billing." />

      <div className="kpi-grid">
        <Kpi label="Total Projects" value={p.total} hint={`${p.active} active`} icon={<FolderKanban size={18} />} onClick={() => nav("/projects")} />
        <Kpi label="Billable Projects" value={p.billable} hint={`${Math.round((p.billable / Math.max(p.total, 1)) * 100)}% of portfolio`} icon={<BadgeDollarSign size={18} />} tone="green" onClick={() => nav("/projects?billable=true")} />
        <Kpi label="Non-Billable Projects" value={p.non_billable} hint="Internal & pre-sales" icon={<FolderKanban size={18} />} tone="violet" onClick={() => nav("/projects?billable=false")} />
        <Kpi label="Total Resources" value={r.total} hint={`${r.allocated} allocated · ${r.billable} billable`} icon={<Users size={18} />} tone="slate" onClick={() => nav("/resources")} />
        <Kpi label="On Bench" value={r.bench} hint={`${Math.round((r.bench / Math.max(r.total, 1)) * 100)}% of workforce`} icon={<Armchair size={18} />} tone="red" onClick={() => nav("/bench")} />
        <Kpi label="Utilization" value={`${r.utilization_pct}%`} hint={`${r.partial} partially allocated`} icon={<Gauge size={18} />} tone="amber" />
        <Kpi label="Monthly Billing" value={compactUsd(b.monthly_revenue)} hint={`${compactUsd(b.annual_run_rate)} annual run-rate`} icon={<BadgeDollarSign size={18} />} tone="green" onClick={() => nav("/billing")} />
        <Kpi label="Open Positions" value={p.open_positions} hint="Across active & pipeline" icon={<UserPlus size={18} />} tone="blue" onClick={() => nav("/hiring")} />
      </div>

      <div className="grid-3">
        <Card title="Project Mix">
          <Donut data={projectMix} />
        </Card>
        <Card title="Resource Allocation">
          <Donut data={resourceMix} />
        </Card>
        <Card title="Projects by Status">
          <ul className="stat-list">
            {Object.entries(p.by_status).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </li>
            ))}
            <li>
              <span>Avg. hourly rate</span>
              <strong>{usd(b.avg_hourly_rate)}</strong>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Monthly Billing by Project">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={b.by_project} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tickFormatter={(v: number) => compactUsd(v)} fontSize={12} />
              <YAxis type="category" dataKey="name" width={170} fontSize={12} />
              <Tooltip formatter={(v) => usd(Number(v))} />
              <Bar dataKey="revenue" fill={C.blue} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Resources by Role">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={roles} margin={{ bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="role" angle={-35} textAnchor="end" interval={0} fontSize={11} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill={C.violet} radius={[4, 4, 0, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Bench Skills Available" actions={<a className="link" onClick={() => nav("/bench")}>View bench →</a>}>
          {data.bench_by_skill.length === 0 ? (
            <p className="muted">Nobody is on the bench.</p>
          ) : (
            <div className="chips">
              {data.bench_by_skill.map((s) => (
                <SkillChip key={s.skill} name={s.skill} level={s.count} />
              ))}
            </div>
          )}
        </Card>
        <Card title="Bench Resources">
          <table className="table compact">
            <tbody>
              {data.recent_bench.map((e) => (
                <tr key={e.id} className="row-link" onClick={() => nav(`/resources/${e.id}`)}>
                  <td>
                    <div className="name">{e.full_name}</div>
                    <div className="sub">{e.role}</div>
                  </td>
                  <td className="muted">{e.years_experience} yrs</td>
                  <td>{e.skills.slice(0, 3).map((s) => s.name).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

function Donut({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="donut">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center">
        <strong>{total}</strong>
        <span>Total</span>
      </div>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="swatch" style={{ background: d.color }} />
            {d.name}
            <strong>{d.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
