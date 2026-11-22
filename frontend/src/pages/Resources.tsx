import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApi, usd } from "../api";
import { useAuth } from "../auth";
import type { EmployeeSummary } from "../types";
import { BillableBadge, Card, Empty, ErrorState, Kpi, Loading, Meter, PageHeader, SkillChip, StatusBadge, Tabs } from "../components/ui";

type F = "all" | "full" | "partial" | "bench";

export default function Resources() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<F>("all");
  const q = params.get("search") ?? "";
  const nav = useNavigate();
  const { can } = useAuth();
  const money = can("money:view");
  const { data, loading, error, reload } = useApi<EmployeeSummary[]>("/employees");

  const rows = useMemo(() => {
    let r = data ?? [];
    if (filter === "full") r = r.filter((e) => e.status === "Fully Allocated");
    if (filter === "partial") r = r.filter((e) => e.status === "Partially Allocated");
    if (filter === "bench") r = r.filter((e) => e.status === "Bench");
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((e) =>
        [e.full_name, e.emp_code, e.role, e.location, ...e.skills.map((k) => k.name), ...e.projects.map((p) => p.name)].some((x) =>
          x.toLowerCase().includes(s)
        )
      );
    }
    return r;
  }, [data, filter, q]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ""} onRetry={reload} />;

  const count = (s: string) => data.filter((e) => e.status === s).length;

  return (
    <>
      <PageHeader title="Resources" subtitle="All employees with their assigned projects, utilization and bill rate. Click a row for skills & project details." />
      <div className="kpi-grid kpi-4">
        <Kpi label="Total Resources" value={data.length} />
        <Kpi label="Fully Allocated" value={count("Fully Allocated")} tone="green" />
        <Kpi label="Partially Allocated" value={count("Partially Allocated")} tone="amber" />
        <Kpi label="On Bench" value={count("Bench")} tone="red" onClick={() => nav("/bench")} />
      </div>

      <Card
        title={
          <Tabs<F>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: data.length },
              { value: "full", label: "Fully Allocated", count: count("Fully Allocated") },
              { value: "partial", label: "Partial", count: count("Partially Allocated") },
              { value: "bench", label: "Bench", count: count("Bench") },
            ]}
          />
        }
        actions={
          <input
            className="input"
            placeholder="Search name, skill, project"
            value={q}
            onChange={(e) => setParams(e.target.value ? { search: e.target.value } : {})}
          />
        }
      >
        {rows.length === 0 ? (
          <Empty>No resources match.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="num">Exp</th>
                  <th>Top Skills</th>
                  <th>Assigned Projects</th>
                  <th>Utilization</th>
                  <th>Status</th>
                  {money && <th className="num">Rate</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="row-link" onClick={() => nav(`/resources/${e.id}`)}>
                    <td>
                      <div className="person">
                        <div className="avatar sm">{initials(e.full_name)}</div>
                        <div>
                          <div className="name">{e.full_name}</div>
                          <div className="sub">{e.emp_code} · {e.location}</div>
                        </div>
                      </div>
                    </td>
                    <td>{e.role}</td>
                    <td className="num">{e.years_experience}</td>
                    <td>
                      <div className="chips">{e.skills.slice(0, 3).map((s) => <SkillChip key={s.name} name={s.name} level={s.proficiency} />)}</div>
                    </td>
                    <td>
                      {e.projects.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        e.projects.map((p) => (
                          <div key={p.id} className="proj-line">
                            {p.name} <span className="muted">({p.allocation_pct}%)</span>
                          </div>
                        ))
                      )}
                      {e.projects.length > 0 && <BillableBadge billable={e.is_billable} />}
                    </td>
                    <td style={{ minWidth: 110 }}>
                      <Meter value={e.utilization} />
                      <div className="sub">{e.utilization}%</div>
                    </td>
                    <td><StatusBadge status={e.status} /></td>
                    {money && <td className="num">{usd(e.hourly_rate ?? 0)}/hr</td>}
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

export const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
