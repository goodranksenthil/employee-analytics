import { useMemo, useState } from "react";
import { useSafeNavigate as useNavigate } from "../auth";
import { api, useApi, usd } from "../api";
import { BillableBadge, Card, ErrorState, Kpi, Loading, PageHeader, Tabs } from "../components/ui";

interface RateRow { role: string; base_rate: number; per_year_rate: number; max_rate: number | null }
interface EmpRate {
  id: number; emp_code: string; full_name: string; role: string; years_experience: number; top_skills: string[];
  base: number; experience: number; skill_premium: number; hourly_rate: number; monthly_full_time: number; capped: boolean;
  billable_pct: number; monthly_billing: number;
}
interface ProjBill { id: number; code: string; name: string; client: string; is_billable: boolean; team_size: number; billable_hours: number; blended_rate: number; monthly_revenue: number }

type T = "projects" | "employees" | "ratecard";

export default function Billing() {
  const nav = useNavigate();
  const [tab, setTab] = useState<T>("projects");
  const card = useApi<RateRow[]>("/billing/rate-card");
  const emps = useApi<EmpRate[]>("/billing/employees");
  const projs = useApi<ProjBill[]>("/billing/projects");
  const [roleFilter, setRoleFilter] = useState("All");

  const empRows = useMemo(() => (emps.data ?? []).filter((e) => roleFilter === "All" || e.role === roleFilter), [emps.data, roleFilter]);

  if (card.loading || emps.loading || projs.loading) return <Loading />;
  const err = card.error || emps.error || projs.error;
  if (err || !card.data || !emps.data || !projs.data) return <ErrorState message={err ?? ""} onRetry={() => { card.reload(); emps.reload(); projs.reload(); }} />;

  const revenue = projs.data.reduce((s, p) => s + p.monthly_revenue, 0);
  const hours = projs.data.reduce((s, p) => s + p.billable_hours, 0);

  return (
    <>
      <PageHeader title="Billing & Rates" subtitle="Bill rates are derived from role, years of experience and skill set. Revenue = rate × 160 hrs × allocation % on billable projects." />
      <div className="kpi-grid kpi-4">
        <Kpi label="Monthly Billing" value={usd(revenue)} tone="green" />
        <Kpi label="Annual Run-Rate" value={usd(revenue * 12)} tone="blue" />
        <Kpi label="Billable Hours / Month" value={hours.toLocaleString()} tone="violet" />
        <Kpi label="Blended Rate" value={`${usd(hours ? revenue / hours : 0, 2)}/hr`} tone="slate" />
      </div>

      <Card
        title={<Tabs<T> value={tab} onChange={setTab} options={[{ value: "projects", label: "By Project" }, { value: "employees", label: "Employee Rates" }, { value: "ratecard", label: "Rate Card" }]} />}
        actions={
          tab === "employees" && (
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option>All</option>
              {card.data.map((r) => <option key={r.role}>{r.role}</option>)}
            </select>
          )
        }
      >
        {tab === "projects" && (
          <table className="table">
            <thead><tr><th>Project</th><th>Client</th><th>Type</th><th className="num">Team</th><th className="num">Billable Hrs</th><th className="num">Blended Rate</th><th className="num">Monthly</th><th className="num">Share</th></tr></thead>
            <tbody>
              {projs.data.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => nav(`/projects/${p.id}`)}>
                  <td><div className="name">{p.name}</div><div className="sub">{p.code}</div></td>
                  <td>{p.client}</td>
                  <td><BillableBadge billable={p.is_billable} /></td>
                  <td className="num">{p.team_size}</td>
                  <td className="num">{p.billable_hours.toLocaleString()}</td>
                  <td className="num">{p.blended_rate ? `${usd(p.blended_rate, 2)}/hr` : "—"}</td>
                  <td className="num">{p.monthly_revenue ? usd(p.monthly_revenue) : "—"}</td>
                  <td className="num">{revenue ? `${((p.monthly_revenue / revenue) * 100).toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "employees" && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Employee</th><th className="num">Exp</th><th>Top Skills</th><th className="num">Base</th><th className="num">+ Exp</th><th className="num">+ Skills</th><th className="num">Rate</th><th className="num">Billable %</th><th className="num">Monthly Billing</th></tr></thead>
              <tbody>
                {empRows.map((e) => (
                  <tr key={e.id} className="row-link" onClick={() => nav(`/resources/${e.id}`)}>
                    <td><div className="name">{e.full_name}</div><div className="sub">{e.role}</div></td>
                    <td className="num">{e.years_experience}</td>
                    <td className="muted">{e.top_skills.join(", ")}</td>
                    <td className="num">{usd(e.base)}</td>
                    <td className="num">{usd(e.experience, 1)}</td>
                    <td className="num">{usd(e.skill_premium, 1)}</td>
                    <td className="num"><strong>{usd(e.hourly_rate)}/hr</strong>{e.capped && <div className="sub">capped</div>}</td>
                    <td className="num">{e.billable_pct}%</td>
                    <td className="num">{e.monthly_billing ? usd(e.monthly_billing) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "ratecard" && <RateCard rows={card.data} onSaved={() => { card.reload(); emps.reload(); }} />}
      </Card>
    </>
  );
}

function omit<V>(obj: Record<string, V>, key: string): Record<string, V> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

function RateCard({ rows, onSaved }: { rows: RateRow[]; onSaved: () => void }) {
  const [edit, setEdit] = useState<Record<string, RateRow>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (role: string) => {
    const r = edit[role];
    try {
      await api(`/billing/rate-card/${encodeURIComponent(role)}`, {
        method: "PUT",
        body: JSON.stringify({ base_rate: Number(r.base_rate), per_year_rate: Number(r.per_year_rate), max_rate: r.max_rate === null || String(r.max_rate) === "" ? null : Number(r.max_rate) }),
      });
      setEdit((s) => omit(s, role));
      setMsg(`Saved ${role}. New allocations will use the updated rate.`);
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const set = (role: string, key: keyof RateRow, v: string) =>
    setEdit((s) => ({ ...s, [role]: { ...s[role], [key]: v as unknown as number } }));

  return (
    <>
      {msg && <p className="muted">{msg}</p>}
      <table className="table">
        <thead><tr><th>Role</th><th className="num">Base $/hr</th><th className="num">+ $/hr per year exp</th><th className="num">Max $/hr</th><th className="num">Example · 5 yrs</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => {
            const e = edit[r.role];
            const v = e ?? r;
            const example = Math.min(Number(v.base_rate) + Number(v.per_year_rate) * 5, v.max_rate ? Number(v.max_rate) : Infinity);
            return (
              <tr key={r.role}>
                <td className="name">{r.role}</td>
                {(["base_rate", "per_year_rate", "max_rate"] as const).map((k) => (
                  <td key={k} className="num">
                    {e ? <input className="input num-input" type="number" step="0.5" value={v[k] ?? ""} onChange={(ev) => set(r.role, k, ev.target.value)} /> : r[k] === null ? "—" : usd(Number(r[k]), 2)}
                  </td>
                ))}
                <td className="num muted">{usd(example)}/hr</td>
                <td className="num">
                  {e ? (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => save(r.role)}>Save</button>{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdit((s) => omit(s, r.role))}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit((s) => ({ ...s, [r.role]: { ...r } }))}>Edit</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Skill premiums (e.g. SAP, Machine Learning, Kubernetes) are added on top of the role rate, scaled by proficiency — top 3 skills count.</p>
    </>
  );
}
