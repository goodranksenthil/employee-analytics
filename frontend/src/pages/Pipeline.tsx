import { useState } from "react";
import { useSafeNavigate as useNavigate } from "../auth";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, ChevronDown, ChevronUp, CircleDollarSign, Layers, TrendingUp, UserPlus, Users } from "lucide-react";
import { compactUsd, useApi, usd } from "../api";
import type { PipelineProject, PipelineResponse } from "../types";
import { Badge, Card, Empty, ErrorState, Kpi, Loading, PageHeader, SkillChip } from "../components/ui";

export default function Pipeline() {
  const { data, loading, error, reload } = useApi<PipelineResponse>("/pipeline");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;
  const s = data.summary;

  return (
    <>
      <PageHeader
        title="Project Pipeline"
        subtitle="Upcoming projects with required technologies, estimated billing from the rate card, and staffing readiness."
      />

      <div className="kpi-grid">
        <Kpi label="Upcoming Projects" value={s.count} hint={s.next_start ? `Next starts ${s.next_start}` : undefined} icon={<CalendarClock size={18} />} />
        <Kpi label="Headcount Required" value={s.headcount} hint={`${s.headcount - s.to_hire} fillable internally`} icon={<Users size={18} />} tone="violet" />
        <Kpi label="Est. Monthly Billing" value={compactUsd(s.monthly_billing)} hint="When all projects are running" icon={<CircleDollarSign size={18} />} tone="green" />
        <Kpi label="New Hires Needed" value={s.to_hire} hint="Not covered by available staff" icon={<UserPlus size={18} />} tone="red" />
        <Kpi label="Total Contract Value" value={compactUsd(s.contract_value)} hint="Monthly billing × duration" icon={<Layers size={18} />} tone="blue" />
        <Kpi label="Weighted Value" value={compactUsd(s.weighted_value)} hint="Contract value × win probability" icon={<TrendingUp size={18} />} tone="amber" />
        <Kpi label="Avg. Win Probability" value={`${data.projects.length ? Math.round(data.projects.reduce((a, p) => a + p.probability, 0) / data.projects.length) : 0}%`} tone="slate" />
        <Kpi label="Required Technologies" value={data.technologies.length} hint="Distinct skills across pipeline" tone="violet" />
      </div>

      <div className="grid-2">
        <Card title="12-Month Billing Forecast">
          <ResponsiveContainer width="100%" height={290}>
            <AreaChart data={data.forecast} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis tickFormatter={(v: number) => compactUsd(v)} fontSize={11} width={60} />
              <Tooltip formatter={(v) => usd(Number(v))} />
              <Legend verticalAlign="top" />
              <Area type="monotone" dataKey="full" name="If all won" stroke="#94a3b8" fill="#e2e8f0" />
              <Area type="monotone" dataKey="weighted" name="Probability-weighted" stroke="#2563eb" fill="#bfdbfe" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Required Technologies">
          <div className="table-wrap" style={{ maxHeight: 290, overflowY: "auto" }}>
            <table className="table compact">
              <thead>
                <tr><th>Technology</th><th>Category</th><th className="num">Needed</th><th className="num">Available</th><th className="num">To Hire</th></tr>
              </thead>
              <tbody>
                {data.technologies.map((t) => (
                  <tr key={t.skill} title={t.projects.join(", ")}>
                    <td><SkillChip name={t.skill} /></td>
                    <td className="muted">{t.category}</td>
                    <td className="num">{t.headcount}</td>
                    <td className="num">{Math.min(t.internal_available, t.headcount)}</td>
                    <td className="num">{t.to_hire > 0 ? <strong className="text-red">{t.to_hire}</strong> : <span className="text-green">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {data.projects.length === 0 ? (
        <Card><Empty>No projects in the pipeline.</Empty></Card>
      ) : (
        data.projects.map((p, i) => <PipelineCard key={p.id} p={p} defaultOpen={i === 0} />)
      )}
    </>
  );
}

function probabilityTone(p: number) {
  return p >= 75 ? "green" : p >= 50 ? "amber" : "red";
}

function PipelineCard({ p, defaultOpen }: { p: PipelineProject; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const nav = useNavigate();

  return (
    <section className="card pipe-card">
      <div className="pipe-head">
        <div className="pipe-title">
          <div className="name link" onClick={() => nav(`/projects/${p.id}`)}>{p.name}</div>
          <div className="sub">{p.code} · {p.client}</div>
        </div>
        <div className="pipe-badges">
          <Badge tone={probabilityTone(p.probability)}>{p.probability}% win probability</Badge>
          <Badge tone="blue">{p.days_to_start > 0 ? `Starts in ${p.days_to_start} days` : "Starting now"}</Badge>
        </div>
      </div>

      <p className="pipe-desc">{p.description}</p>

      <div className="pipe-stats">
        <div><span>Start → End</span><strong>{p.start_date} → {p.end_date}</strong></div>
        <div><span>Duration</span><strong>{p.duration_months} months</strong></div>
        <div><span>Team</span><strong>{p.headcount} people</strong></div>
        <div><span>Blended rate</span><strong>{p.blended_rate ? `${usd(p.blended_rate, 2)}/hr` : "—"}</strong></div>
        <div><span>Monthly billing</span><strong>{usd(p.monthly_billing)}</strong></div>
        <div><span>Contract value</span><strong>{usd(p.contract_value)}</strong></div>
        <div><span>Weighted value</span><strong>{usd(p.weighted_value)}</strong></div>
        <div>
          <span>Staffing readiness</span>
          <strong>{p.readiness_pct}% <span className="muted small">({p.to_hire} to hire)</span></strong>
          <div className="meter"><div className={`meter-fill tone-${p.readiness_pct >= 75 ? "green" : p.readiness_pct >= 40 ? "amber" : "red"}`} style={{ width: `${p.readiness_pct}%` }} /></div>
        </div>
      </div>

      <div className="pipe-tech">
        <span className="muted small">Technologies:</span>
        <div className="chips">{p.technologies.map((t) => <SkillChip key={t} name={t} />)}</div>
        <button className="btn btn-ghost btn-sm pipe-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "Hide" : "Show"} requirements & billing
        </button>
      </div>

      {open && (
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Technology</th><th>Role</th><th className="num">Headcount</th><th className="num">Level / Exp</th>
                <th className="num">Est. Rate</th><th className="num">Monthly Billing</th><th>Internal Candidates</th><th className="num">To Hire</th>
              </tr>
            </thead>
            <tbody>
              {p.requirements.map((r) => (
                <tr key={`${r.skill}-${r.role}`}>
                  <td><SkillChip name={r.skill} /></td>
                  <td>{r.role}</td>
                  <td className="num">{r.headcount}</td>
                  <td className="num">{r.min_proficiency}/5 · {r.min_experience}y+</td>
                  <td className="num">{r.est_rate ? `${usd(r.est_rate)}/hr` : "—"}</td>
                  <td className="num">{r.monthly_billing ? usd(r.monthly_billing) : "—"}</td>
                  <td>
                    {r.candidates.length === 0 ? (
                      <span className="muted">None available</span>
                    ) : (
                      r.candidates.map((c) => (
                        <a key={c.employee_id} className="link block" onClick={() => nav(`/resources/${c.employee_id}`)}>
                          {c.full_name} <span className="muted">({c.available_pct}% free)</span>
                        </a>
                      ))
                    )}
                  </td>
                  <td className="num">{r.to_hire > 0 ? <strong className="text-red">{r.to_hire}</strong> : <span className="text-green">0</span>}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}><strong>Total</strong></td>
                <td className="num"><strong>{p.headcount}</strong></td>
                <td />
                <td className="num"><strong>{p.blended_rate ? `${usd(p.blended_rate, 2)}/hr` : "—"}</strong></td>
                <td className="num"><strong>{usd(p.monthly_billing)}</strong></td>
                <td />
                <td className="num"><strong>{p.to_hire}</strong></td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">Estimated rate = role base + per-year rate × minimum experience + the technology's skill premium at the minimum level. Monthly billing = rate × 160 h × headcount.</p>
        </div>
      )}
    </section>
  );
}
